from fastapi import FastAPI

app = FastAPI(title="insta-pilot python service")


@app.get("/health")
def health():
    return {"status": "ok"}
