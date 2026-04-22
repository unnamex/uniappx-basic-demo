import os
filepath = r"f:\workProject\avpbc-pop\scripts\generate_v6_srd.py"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()
with open(filepath, "w", encoding="utf-8") as f:
    for line in lines:
        if '"dataSource"' not in line:
            f.write(line)
