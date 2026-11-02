"""Markdown-Antwort in gesprochenen Text umwandeln.

Formatierungszeichen entfernen, Codeblöcke auslassen, Links auf ihren Text reduzieren
und den Text in begrenzte Segmente teilen."""
import re

FENCE = re.compile(r"```.*?```|~~~.*?~~~", re.S)
HTML = re.compile(r"<[^>]{1,200}>")
IMAGE = re.compile(r"!\[([^\]]*)\]\([^)]*\)")
LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")
INLINE_CODE = re.compile(r"`([^`]*)`")
HEADING = re.compile(r"^\s{0,3}#{1,6}\s+", re.M)
QUOTE = re.compile(r"^\s{0,3}>\s?", re.M)
LIST = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+", re.M)
TABLE_SEP = re.compile(r"^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$", re.M)
EMPHASIS = re.compile(r"(\*\*|__|\*|_|~~)")
SENTENCE = re.compile(r"(?<=[.!?:;])\s+")


def to_plain(markdown: str) -> str:
    text = FENCE.sub(" ", markdown)  # Codeblöcke werden standardmäßig ausgelassen
    text = HTML.sub(" ", text)
    text = IMAGE.sub(r"\1", text)
    text = LINK.sub(r"\1", text)
    text = INLINE_CODE.sub(r"\1", text)
    text = TABLE_SEP.sub(" ", text)
    text = HEADING.sub("", text)
    text = QUOTE.sub("", text)
    text = LIST.sub("", text)
    text = EMPHASIS.sub("", text)
    text = text.replace("|", " ")
    return re.sub(r"\s+", " ", text).strip()


def segments(markdown: str, max_chars: int = 600) -> list[str]:
    """Sprechbare Segmente, jedes höchstens max_chars lang, Satzgrenzen bevorzugt."""
    plain = to_plain(markdown)
    if not plain:
        return []
    out, current = [], ""
    for sentence in SENTENCE.split(plain):
        while len(sentence) > max_chars:  # überlanger Satz: an Leerzeichen teilen
            cut = sentence.rfind(" ", 0, max_chars)
            cut = cut if cut > 0 else max_chars
            piece, sentence = sentence[:cut].strip(), sentence[cut:].strip()
            if current:
                out.append(current)
                current = ""
            out.append(piece)
        if current and len(current) + 1 + len(sentence) > max_chars:
            out.append(current)
            current = sentence
        else:
            current = f"{current} {sentence}".strip()
    if current:
        out.append(current)
    return out
