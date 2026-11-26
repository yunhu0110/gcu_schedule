"""DB 없이 KR-SBERT 코사인 유사도 상식 검증."""
import torch
from sentence_transformers import SentenceTransformer
dev = "mps" if torch.backends.mps.is_available() else "cpu"
m = SentenceTransformer("snunlp/KR-SBERT-V40K-klueNLI-augSTS", device=dev)
pairs = [
    ("사과","바나나"), ("사과","자동차"),
    ("바다","강"), ("바다","컴퓨터"),
    ("의사","간호사"), ("의사","망치"),
    ("기쁨","슬픔"), ("왕","여왕"), ("개","고양이"), ("개","책상"),
]
words = sorted({w for p in pairs for w in p})
emb = {w:e for w,e in zip(words, m.encode(words, normalize_embeddings=True))}
import numpy as np
print(f"device={dev}\n코사인 유사도(1=동일):")
for a,b in pairs:
    print(f"  {a:4} ~ {b:5}: {float(np.dot(emb[a],emb[b])):.3f}")
