from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

LearningLanguage = Literal["en", "zh", "es", "de", "tr", "tt", "ar", "fr", "pt"]
WordSort = Literal[
    "term-asc", "term-desc", "level-asc", "level-desc", "cefr-asc", "cefr-desc", "newest", "oldest"
]
ReadingMode = Literal["easy", "pinyin", "ipa"]
CefrLevel = Literal["A1", "A2", "B1", "B2", "C1", "C2"]


class WordMixPreferences(BaseModel):
    size: int = Field(default=200, ge=1, le=1000)
    levels: list[Literal[1, 3, 4, 5]] = Field(default_factory=lambda: [1, 3, 4], min_length=1, max_length=4)
    cefr_levels: list[CefrLevel] = Field(default_factory=list, max_length=6)
    cooldown_days: int = Field(default=1, ge=0, le=365)
    balance_topics: bool = True

    model_config = ConfigDict(extra="forbid", strict=True)

    @model_validator(mode="after")
    def unique_selections(self):
        if len(set(self.levels)) != len(self.levels) or len(set(self.cefr_levels)) != len(self.cefr_levels):
            raise ValueError("Select each knowledge or CEFR level only once")
        return self


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
    word_mix: WordMixPreferences | None = None

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
    word_mix: WordMixPreferences | None = None

    model_config = ConfigDict(extra="forbid", strict=True)

    @model_validator(mode="after")
    def reject_nulls(self):
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Omit a preference to leave it unchanged; null is not a setting")
        return self
