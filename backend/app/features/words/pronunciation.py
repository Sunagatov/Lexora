"""Keep pronunciation attached to the spelling it describes."""

PRONUNCIATION_FIELDS = (
    "transliteration", "pronunciation_ipa", "pronunciation_audio_url",
    "pronunciation_easy", "pronunciation_note_ru",
)


def pronunciation_after_rename(before: dict, incoming: dict) -> dict:
    if incoming.get("term", before["term"]) == before["term"]:
        return {}
    # An exported old pronunciation is not a new reading for a renamed word.
    return {
        name: None for name in PRONUNCIATION_FIELDS
        if name not in incoming or incoming[name] == before.get(name)
    }
