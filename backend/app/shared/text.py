import re
import unicodedata


def normalize_term(term: str) -> str:
    """Normalize a vocabulary term for duplicate detection: NFKC, collapse whitespace, lowercase."""
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', term)).strip().lower()


def slugify(value: str, max_len: int = 200) -> str:
    """Convert a string to a URL-safe slug."""
    normalized = unicodedata.normalize('NFKD', value)
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', normalized.encode('ascii', 'ignore').decode()).strip('-').lower()
    return slug[:max_len]
