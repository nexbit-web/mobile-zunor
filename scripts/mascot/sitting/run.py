"""Обвести сидячого кота з картинки → ../cat-sitting.json (дані для dress.mjs).

Картинку source.webp власник зробив у ШІ за нашою наліпкою (cat-love) і
попросив «обвести по контуру» й посадити в «Вигляд». Обведення машинне:

  1. lines.py   — темне «чорнило» контуру → осьові лінії (тоншення) і
                  суцільні плями (зіниці з відблисками, носик, веснянки);
  2. regions.py — області між лініями (шерсть, білки очей, рот, язик —
                  кожна свого кольору) і плями всередині шерсті (смуги,
                  відблиски, серединка вуха); хвіст і очі — окремими
                  частинами (хвіст гойдається, очі кліпають).

Запуск:  python scripts/mascot/sitting/run.py   (потрібні numpy, scipy,
contourpy, Pillow). Потім — node scripts/mascot/dress.mjs.
"""
import os
import runpy
import shutil
import sys
import tempfile

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
# Консоль Windows (cp1251) не друкує «→» — пишемо в UTF-8.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
work = tempfile.mkdtemp(prefix='cat-sitting-')
try:
    src = Image.open(os.path.join(HERE, 'source.webp')).convert('RGB')
    src.save(os.path.join(work, 'src.png'))
    # Чорнило — у 2× (тоншення точніше): темні пікселі контуру
    big = np.array(src.resize((src.width * 2, src.height * 2), Image.LANCZOS)).astype(int)
    Image.fromarray(np.where(big.max(axis=2) < 90, 0, 255).astype(np.uint8)).save(os.path.join(work, 'ink.png'))
    os.chdir(work)
    sys.argv = ['lines.py', '1', '1.6']
    runpy.run_path(os.path.join(HERE, 'lines.py'), run_name='__main__')
    sys.argv = ['regions.py']
    runpy.run_path(os.path.join(HERE, 'regions.py'), run_name='__main__')
    shutil.copy(os.path.join(work, 'cat-sitting.json'), os.path.join(HERE, '..', 'cat-sitting.json'))
    print('→', os.path.normpath(os.path.join(HERE, '..', 'cat-sitting.json')))
finally:
    os.chdir(HERE)
    shutil.rmtree(work, ignore_errors=True)
