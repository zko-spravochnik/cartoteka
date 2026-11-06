# -*- coding: utf-8 -*-
"""
КАРТОТЕКА v1.1.0.0 - sekretar.py: РОБОТ-СЕКРЕТАРЬ (GitHub Actions).
Раз в 15 минут (и по кнопке) заходит в облачный шлюз, забирает одобренные заявки со статусом задания «К внесению»,
вносит каждую в нужную базу села теми же правилами, что и локальный сервер (общий модуль bazy_core.py), обновляет счётчики
села в конфиге и сообщает шлюзу результат. Шлюз сам пришлёт вам рапорт в Telegram и обновит плашку заявки.

Секреты (только Repository Secrets, в файлах их нет и никогда не печатаются):
  GOOGLE_WEBHOOK, ADMIN_CODE, MASTER_CODE.   Запись в репозиторий идёт встроенным токеном GITHUB_TOKEN запуска.
Берутся только заявки своего контура (CART_ENV=prod): тестовые заявки боевую базу не затрагивают.
"""
import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import bazy_core

HERE = os.path.dirname(os.path.abspath(__file__))
FILE_RE = re.compile(r'^baza_zko_([a-z0-9]+)_[a-z0-9_\-]+\.txt$')
GH_API = os.environ.get('CART_GH_API', 'https://api.github.com')

ERRORS = {
    'link_mismatch': 'Г2 и Г1 не связаны (категория и ID не совпадают)',
    'idclash': 'ID уже занят в новой категории',
    'mismatch': 'старая строка в базе не совпадает с оригиналом заявки',
    'no_id': 'в базе нет записи с таким ID',
    'multi': 'в базе несколько записей с таким ID',
    'index_mismatch': 'не совпали индексы села или служебные графы',
    'bad_folder': 'такой категории нет в каталоге',
    'verify_failed': 'проверка после переноса не пройдена',
    'chat_full': 'в селе заполнены все номера чатов',
    'bad_file': 'недопустимое имя файла базы',
    'gh_bad_token': 'GitHub не принял токен запуска',
    'gh_forbidden': 'нет права записи в репозиторий',
    'gh_not_found': 'файл базы или репозиторий не найден',
    'gh_conflict': 'конфликт версий файла (повторите)',
    'gh_failed': 'GitHub не принял запись',
    'network': 'нет связи',
}


class Err(Exception):
    def __init__(self, code):
        Exception.__init__(self, code)
        self.code = code


def real_http(method, url, headers, body=None, timeout=30):
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode('utf-8', 'replace')
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        try:
            raw = e.read().decode('utf-8', 'replace')
            return e.code, (json.loads(raw) if raw else {})
        except Exception:
            return e.code, {}
    except Exception:
        raise Err('network')


def gh_err(st):
    return {401: 'gh_bad_token', 403: 'gh_forbidden', 404: 'gh_not_found', 409: 'gh_conflict', 422: 'gh_conflict'}.get(st, 'gh_failed')


class Secretary:
    def __init__(self, env, http=real_http, root=HERE, sleep=time.sleep):
        self.env, self.http, self.root, self.sleep = env, http, root, sleep
        self.hook = env.get('GOOGLE_WEBHOOK', '')
        self.code, self.master = env.get('ADMIN_CODE', ''), env.get('MASTER_CODE', '')
        self.token = env.get('GITHUB_TOKEN', '')
        repo = env.get('GITHUB_REPOSITORY', '')
        self.owner, _, self.repo = repo.partition('/')
        self.contour = env.get('CART_ENV', 'prod')
        self.cfg_name = 'config.json' if self.contour == 'prod' else 'test_config.json'
        self.branch = env.get('GITHUB_REF_NAME') or 'main'
        bazy_core.ROOT = root

    # ---- шлюз ----
    def cloud(self, payload):
        body = dict(payload, code=self.code, master=self.master)
        st, j = self.http('POST', self.hook, {'Content-Type': 'text/plain;charset=utf-8'}, body)
        return j if isinstance(j, dict) else {}

    # ---- GitHub ----
    def gh_headers(self):
        return {'Authorization': 'Bearer ' + self.token, 'Accept': 'application/vnd.github+json', 'User-Agent': 'cartoteka-sekretar',
                'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json'}

    def gh_get(self, path):
        url = '%s/repos/%s/%s/contents/%s?ref=%s' % (GH_API, self.owner, self.repo, urllib.parse.quote(path), urllib.parse.quote(self.branch))
        st, j = self.http('GET', url, self.gh_headers())
        if st != 200:
            raise Err(gh_err(st))
        sha = j.get('sha', '')
        b64 = (j.get('content') or '').replace('\n', '')
        if not b64 and sha:
            st2, jb = self.http('GET', '%s/repos/%s/%s/git/blobs/%s' % (GH_API, self.owner, self.repo, sha), self.gh_headers())
            if st2 != 200:
                raise Err(gh_err(st2))
            b64 = (jb.get('content') or '').replace('\n', '')
        return base64.b64decode(b64).decode('utf-8'), sha

    def gh_put(self, path, text, sha, message):
        body = {'message': message, 'content': base64.b64encode(text.encode('utf-8')).decode('ascii'), 'sha': sha, 'branch': self.branch}
        st, j = self.http('PUT', '%s/repos/%s/%s/contents/%s' % (GH_API, self.owner, self.repo, urllib.parse.quote(path)), self.gh_headers(), body)
        if st in (200, 201):
            return j
        raise Err(gh_err(st))

    def village_path(self, file_name):
        try:
            with open(os.path.join(self.root, self.cfg_name), encoding='utf-8') as f:
                for v in json.load(f).get('villages', []):
                    if v.get('file') == file_name and v.get('path'):
                        return v['path']
        except Exception:
            pass
        m = FILE_RE.match(file_name)
        return 'bazy_zko/%s/%s' % (m.group(1), file_name)

    # ---- одна заявка ----
    def apply(self, job):
        file_name, kind = job.get('file', ''), job.get('kind', '')
        if not FILE_RE.match(file_name) or kind not in ('NEW', 'EDIT'):
            raise Err('bad_file')
        path = self.village_path(file_name)
        line, original = job.get('row', ''), job.get('original', '')
        res, new = None, ''
        for attempt in range(3):
            text, sha = self.gh_get(path)
            new, st, used = bazy_core.apply_line_op2(text, kind, line, original)
            if st == 'dup':
                return {'commit': 'уже'}
            if st != 'ok':
                raise Err(st)
            try:
                res = self.gh_put(path, new, sha, 'КАРТОТЕКА: %s %s · %s (секретарь)' % (kind, used.split(' | ')[0].strip(), file_name))
                break
            except Err as e:
                if e.code == 'gh_conflict' and attempt < 2:
                    self.sleep(0.6)
                    continue
                raise
        commit = str((res.get('commit') or {}).get('sha', ''))[:7]
        try:        # счётчики села; сбой не отменяет коммит
            ctext, csha = self.gh_get(self.cfg_name)
            cj = json.loads(ctext)
            cnt = bazy_core.counts_of_text(new)
            if cj.setdefault('counts', {}).get(file_name) != cnt:
                cj['counts'][file_name] = cnt
                self.gh_put(self.cfg_name, json.dumps(cj, ensure_ascii=False, indent=2) + '\n', csha, 'КАРТОТЕКА: счётчики %s' % file_name)
        except Exception:
            pass
        return {'commit': commit}

    def run(self):
        if not (self.hook and self.code and self.master and self.token and self.owner and self.repo):
            print('Нет обязательных секретов или имени репозитория: работа остановлена.')
            return 2
        lst = self.cloud({'action': 'jobsList', 'env': self.contour})
        if not lst.get('ok'):
            print('Шлюз не выдал список заданий: %s' % lst.get('error', 'нет ответа'))
            return 3
        done = failed = 0
        for job in lst.get('items', []):
            if not self.cloud({'action': 'jobClaim', 'uid': job['uid']}).get('ok'):
                continue
            try:
                out = self.apply(job)
                self.cloud({'action': 'jobDone', 'uid': job['uid'], 'ok': True, 'commit': '' if out['commit'] == 'уже' else out['commit']})
                done += 1
                print('внесено: %s %s' % (job.get('kind'), job.get('id')))
            except Err as e:
                self.cloud({'action': 'jobDone', 'uid': job['uid'], 'ok': False, 'error': ERRORS.get(e.code, e.code)})
                failed += 1
                print('ошибка: %s %s: %s' % (job.get('kind'), job.get('id'), e.code))
        print('Готово. Внесено: %d, с ошибкой: %d.' % (done, failed))
        return 0


if __name__ == '__main__':
    sys.exit(Secretary(os.environ).run())
