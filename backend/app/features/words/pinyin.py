"""Search keys for Mandarin romanisation; never rewrite saved Pinyin."""

import re
import unicodedata

TONES = dict(zip("āáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜ", "aaaaeeeeiiiioooouuuuvvvvv"))
SEPARATORS = " -'’"


def pinyin_key(value: str) -> str:
    value = unicodedata.normalize("NFC", value.lower()).replace("u:", "v").translate(str.maketrans(TONES))
    return re.sub(r"[\s'’\-1-5]+", "", value)
