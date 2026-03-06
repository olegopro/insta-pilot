import json

from fastapi import FastAPI
from pydantic import BaseModel
from instagrapi import Client
from typing import Optional

app = FastAPI(title="insta-pilot python service")


class LoginRequest(BaseModel):
    login: str
    password: str
    proxy: Optional[str] = None


class LoginResponse(BaseModel):
    success: bool
    session_data: Optional[str] = None
    full_name: Optional[str] = None
    profile_pic_url: Optional[str] = None
    error: Optional[str] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/login", response_model=LoginResponse)
async def login(data: LoginRequest):
    try:
        cl = Client()
        
        if data.proxy:
            cl.set_proxy(data.proxy)

        cl.login(data.login, data.password)
        session_data = json.dumps(cl.get_settings())
        user_info = cl.account_info()

        return LoginResponse(
            success=True,
            session_data=session_data,
            full_name=user_info.full_name,
            profile_pic_url=str(user_info.profile_pic_url)
        )

    except Exception as e:
        return LoginResponse(success=False, error=str(e))
