
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
import joblib

# Small starter dataset for testing the training workflow.
# 0 = legitimate, 1 = phishing.
data = [
    ("https://www.wikipedia.org", 0),
    ("https://www.python.org", 0),
    ("https://www.microsoft.com", 0),
    ("https://www.google.com", 0),
    ("https://www.github.com", 0),
    ("https://www.openai.com", 0),
    ("http://secure-login-verify.example.com/account", 1),
    ("http://account-update-security.example.com/login", 1),
    ("http://free-prize-claim.example.com/winner", 1),
    ("http://verify-bank-account.example.com/signin", 1),
    ("http://password-reset-alert.example.com/confirm", 1),
    ("http://gift-card-reward.example.com/claim", 1),
]

df = pd.DataFrame(data, columns=["url", "label"])

X_train, X_test, y_train, y_test = train_test_split(
    df["url"],
    df["label"],
    test_size=0.25,
    random_state=42,
    stratify=df["label"]
)

model = Pipeline([
    ("tfidf", TfidfVectorizer(analyzer="char", ngram_range=(3, 5))),
    ("classifier", LogisticRegression(max_iter=1000))
])

model.fit(X_train, y_train)

predictions = model.predict(X_test)
print("Test accuracy:", accuracy_score(y_test, predictions))
print(classification_report(
    y_test,
    predictions,
    target_names=["Legitimate", "Phishing"],
    zero_division=0
))

# Save the trained model inside the ml folder.
joblib.dump(model, "ml/url_model.joblib")
print("Model saved to ml/url_model.joblib")
