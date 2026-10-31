from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

LearningLanguage = Literal["en", "zh", "es", "de", "tr", "tt", "ar", "fr", "pt"]
WordSort = Literal[
    "term-asc", "term-desc", "level-asc", "level-desc", "cefr-asc", "cefr-desc", "newest", "oldest"
]
ReadingMode = Literal["easy", "pinyin", "ipa"]


class Preferences(BaseModel):
    language: LearningLanguage = "en"
    translation_language: Literal["ru", "en"] = "ru"
    page_size: Literal[50, 100, 200] = 50
    sort: WordSort = "level-asc"
    theme: Literal["dark", "light", "system"] = "dark"
    swipes: bool = True
    pronunciation: bool = True
    translations: bool = True
    summary: bool = True
    badges: bool = True
    colours: bool = True
    animations: bool = True
    pronunciation_modes: dict[LearningLanguage, ReadingMode] = Field(default_factory=dict)

    model_config = ConfigDict(extra="forbid", strict=True)


class PreferencesPatch(BaseModel):
    language: LearningLanguage | None = None
    translation_language: Literal["ru", "en"] | None = None
    page_size: Literal[50, 100, 200] | None = None
    sort: WordSort | None = None
    theme: Literal["dark", "light", "system"] | None = None
    swipes: bool | None = None
    pronunciation: bool | None = None
    translations: bool | None = None
    summary: bool | None = None
    badges: bool | None = None
    colours: bool | None = None
    animations: bool | None = None
    pronunciation_modes: dict[LearningLanguage, ReadingMode] | None = None

    model_config = ConfigDict(extra="forbid", strict=True)

    @model_validator(mode="after")
    def reject_nulls(self):
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Omit a preference to leave it unchanged; null is not a setting")
        return self
