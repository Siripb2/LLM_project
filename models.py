from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class AnalysisHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    log_hash = db.Column(db.String(64), nullable=False, index=True)
    model_used = db.Column(db.String(64), nullable=False)
    response_text = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='completed')
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "model_used": self.model_used,
            "status": self.status,
            "text": self.response_text,
            "timestamp": self.timestamp.isoformat() + "Z"
        }
