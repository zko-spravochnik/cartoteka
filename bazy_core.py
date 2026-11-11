# -*- coding: utf-8 -*-
"""
КАРТОТЕКА v1.2.1.4 - bazy_core.py: ОБЩАЯ ЛОГИКА ПРАВКИ БАЗ (без сети и без секретов).
Одна и та же логика работает в локальном сервере (cartoteka_server.py) и у робота-секретаря GitHub Actions (sekretar.py):
добавление строки, замена, перенос между категориями, проверка индексов, счётчики села.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))


COMMON_FILE = 'baza_zko_obshaya.txt'     # v1.2.1.0: общий файл «Межгород / Вся область» (не село), индекс села в масках = 166
COMMON_X = 166
DB_FILE_RE = re.compile(r'^baza_zko_(?:([a-z0-9]+)_[a-z0-9_\-]+|obshaya)\.txt$')   # группа 1 = папка района; у общего файла её нет
OK_MARKERS = ('$', 'wa', 'tg')


def is_delete_request(kind, line=''):
    """v1.2.1.0: ЗАЩИТА ОТ УДАЛЕНИЯ. Физическое удаление строк облачному секретарю не доверяется: DELETE и маркеры DELETE_* отсекаются."""
    if str(kind or '').upper().startswith('DELETE'):
        return True
    p = str(line or '').split(' | ')
    return len(p) == 20 and p[19].strip().upper().startswith('DELETE')
LAST_MIGRATION = []   # журнал миграции категорий: «старый ID → новый ID · Г2 → Г2» (только в памяти)


def _clean_line(x):
    return str(x or '').replace('\ufeff', '').strip()


def apply_line_op(text, kind, line, original=''):
    t, st, _ln = apply_line_op2(text, kind, line, original)
    return t, st


_CATS = {}


def _norm_name(x):
    return re.sub(r'[\s\-–—−]+', '', str(x or '').lower().replace('ё', 'е'))


def folder_ids(folder):
    """v1.0.0.6: «Магазины — Онлайн-магазины/ПВЗ» -> (плитка, подкатегория, канонический текст) по categories.json (ru и kz,
    без учёта регистра, пробелов и вида тире). Не найдено -> None."""
    try:
        if not _CATS:
            with open(os.path.join(ROOT, 'categories.json'), encoding='utf-8') as f:
                _CATS.update(json.load(f))
        parts = re.split(r'\s*[—–]\s+|\s+[-−]\s+', str(folder or '').strip(), maxsplit=1)
        if len(parts) != 2:
            return None
        a, b = _norm_name(parts[0]), _norm_name(parts[1])
        for st in _CATS.get('superTiles', []):
            if a in (_norm_name(st.get('ru')), _norm_name(st.get('kz'))):
                for sb in _CATS.get('subTiles', {}).get(str(st['id']), []):
                    if b in (_norm_name(sb.get('ru')), _norm_name(sb.get('kz'))):
                        return int(st['id']), int(sb['sub']), '%s — %s' % (st['ru'], sb['ru'])
    except Exception:
        pass
    return None


def free_id_in_bucket(parts, c, sb):
    base = (c * 10 + sb) * 100
    used = set()
    for x in parts:
        xf = _clean_line(x).split(' | ')
        if len(xf) == 20 and xf[0].strip().isdigit():
            used.add(int(xf[0].strip()))
    inb = [n for n in used if base < n <= base + 99]
    nxt = (max(inb) + 1) if inb else base + 1
    if nxt <= base + 99:
        return nxt
    return next((n for n in range(base + 1, base + 100) if n not in used), 0)


def apply_line_op2(text, kind, line, original=''):
    """-> (новый_текст, статус, использованная_строка).
    Статусы: ok | dup | idclash | no_id | multi | mismatch | index_mismatch | bad_row | delete_manual.
    v1.0.0.6: строки-чаты (Г20 = wa|tg): при занятом ID новой ссылки сервер сам берёт первый свободный номер 0001-1100;
    DELETE чата выполняется автоматически (по точной строке либо по ID+ссылке); удаление бизнеса и жителей остаётся ручным."""
    line = _clean_line(line)
    nf = line.split(' | ')
    if '\n' in line or '\r' in line or len(nf) != 20 or nf[19].strip() not in OK_MARKERS or not nf[0].strip():
        return text, 'bad_row', line
    is_chat = nf[19].strip() in ('wa', 'tg')
    nid = nf[0].strip()
    parts = text.split('\n')
    if kind == 'DELETE':
        if not is_chat:
            return text, 'delete_manual', line
        for i, x in enumerate(parts):
            cx = _clean_line(x)
            xf = cx.split(' | ')
            if cx and len(xf) == 20 and xf[19].strip() in ('wa', 'tg') and (cx == line or (xf[0].strip() == nid and xf[3].strip() == nf[3].strip())):
                del parts[i]
                return '\n'.join(parts), 'ok', line
        return text, 'dup', line          # такой плашки в файле уже нет
    if any(_clean_line(x) == line for x in parts):
        return text, 'dup', line
    def _ids(pid):
        return [i for i, x in enumerate(parts)
                if _clean_line(x) and not _clean_line(x).startswith('#') and len(_clean_line(x).split(' | ')) == 20
                and _clean_line(x).split(' | ')[0].strip() == pid]
    oid = _clean_line(original).split(' | ')[0].strip() if (kind == 'EDIT' and original) else nid
    same = _ids(oid) if kind == 'EDIT' else _ids(nid)
    if kind == 'EDIT':
        if not same:
            return text, 'no_id', line
        if len(same) > 1:
            return text, 'multi', line
        i = same[0]
        if original and _clean_line(parts[i]) != _clean_line(original):
            return text, 'mismatch', line
        # v1.0.0.6: СЕРВЕР — ГЛАВНЫЙ ПО СВЯЗКЕ Г2↔Г1. Если категория в Г2 изменилась, сервер сам считает новый ID и маски.
        ofx = _clean_line(parts[i]).split(' | ')
        if not is_chat and nf[1].strip().upper() != 'ЖИТЕЛИ' and nf[1].strip() != ofx[1].strip():
            ids = folder_ids(nf[1])
            if not ids:
                return text, 'bad_folder', line
            c, sbn, canon = ids
            if (int(nid) // 1000, (int(nid) // 100) % 10) != (c, sbn) if nid.isdigit() else True:
                newid = free_id_in_bucket(parts, c, sbn)
                if not newid:
                    return text, 'idclash', line
                hp = nf[16].strip().split('/')
                sp = nf[18].strip().split('/')
                if len(hp) != 10 or len(sp) != 7:
                    return text, 'link_mismatch', line
                hp[1], hp[2], hp[3] = str(c), str(sbn), '0'
                sp[4] = '0'
                nf[0], nf[16], nf[18] = str(newid), '/'.join(hp), '/'.join(sp)
                nid = str(newid)
            nf[1] = canon
            line = ' | '.join(nf)
        # проверка индексов: индекс села X в масках Г17–Г19 и служебные графы Г14–Г16 в новой строке не должны отличаться от старой
        of = _clean_line(parts[i]).split(' | ')
        for k in (13, 14, 15):
            if of[k].strip() != nf[k].strip():
                return text, 'index_mismatch', line
        for k in (16, 17, 18):
            ox, nx = of[k].strip().split('/')[0], nf[k].strip().split('/')[0]
            if of[k].strip() != '0' and nf[k].strip() != '0' and ox != nx:
                return text, 'index_mismatch', line
        if oid != nid:
            # v1.0.0.6: МИГРАЦИЯ между категориями. Г2 и Г1 обязаны быть связаны; старая строка удаляется, новая встаёт в свою секцию.
            if not nid.isdigit() or not oid.isdigit() or of[1].strip() == nf[1].strip():
                return text, 'link_mismatch', line
            hp = nf[16].strip().split('/')
            fid = folder_ids(nf[1])
            if len(hp) != 10 or not fid or (int(nid) // 1000, (int(nid) // 100) % 10) != (int(hp[1]), int(hp[2])) or (fid[0], fid[1]) != (int(hp[1]), int(hp[2])):
                return text, 'link_mismatch', line      # Г1 не соответствует маске Г17 (C/T1)
            if _ids(nid):
                return text, 'idclash', line
            eol = '\r' if parts[i].endswith('\r') else ''
            del parts[i]
            ins = len(parts)
            for j, x in enumerate(parts):          # место в секции: перед первой строкой с большим ID (файл идёт по возрастанию ID)
                xf = _clean_line(x).split(' | ')
                if len(xf) == 20 and xf[0].strip().isdigit() and xf[19].strip() not in ('wa', 'tg') and int(xf[0].strip()) > int(nid):
                    ins = j
                    break
            if ins == len(parts) and parts and parts[-1] == '':
                ins -= 1
            parts.insert(ins, line + eol)
            cnt_old = sum(1 for x in parts if _clean_line(x).split(' | ')[0].strip() == oid)
            cnt_new = sum(1 for x in parts if _clean_line(x).split(' | ')[0].strip() == nid)
            if cnt_old != 0 or cnt_new != 1:
                return text, 'verify_failed', line
            LAST_MIGRATION.append('%s → %s · %s → %s' % (oid, nid, of[1].strip(), nf[1].strip()))
            return '\n'.join(parts), 'ok', line
        eol = '\r' if parts[i].endswith('\r') else ''
        parts[i] = line + eol
        return '\n'.join(parts), 'ok', line
    if same:
        if not is_chat:
            return text, 'idclash', line
        used = set()
        for x in parts:
            xf = _clean_line(x).split(' | ')
            if len(xf) == 20 and xf[0].strip().isdigit():
                used.add(int(xf[0].strip()))
        free = next((n for n in range(1, 1101) if n not in used), 0)
        if not free:
            return text, 'chat_full', line
        nf[0] = '%04d' % free
        line = ' | '.join(nf)
    if text and not text.endswith('\n'):
        text += '\n'
    return text + line + '\n', 'ok', line


def counts_of_text(text):
    biz = res = 0
    for ln in text.splitlines():
        raw = ln.strip()
        if not raw or raw.startswith('#'):
            continue
        p = [x.strip() for x in raw.split(' | ')]
        if len(p) != 20 or p[19] in ('wa', 'tg') or (p[19] != '$' and re.match(r'^(NEW|ORIGINAL|EDIT|DELETE_.+)$', p[19])):
            continue
        if p[1].upper() == 'ЖИТЕЛИ':
            res += 1
        else:
            biz += 1
    return [biz, res]
