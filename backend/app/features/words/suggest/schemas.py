from pydantic import BaseModel, Field


class SuggestTopicRequest(BaseModel):
    term: str = Field(min_length=1, max_length=200)
    translation: str = Field(min_length=1, max_length=500)


class SuggestTopicResponse(BaseModel):
    topic_name: str
