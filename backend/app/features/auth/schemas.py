from pydantic import BaseModel


class LoginRequest(BaseModel):
    password: str
