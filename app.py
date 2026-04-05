import os
import json
import hashlib
from flask import Flask, render_template, request, jsonify, Response
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor
from analyzer import analyze_log_stream, analyze_log_full
from models import db, AnalysisHistory

load_dotenv()

app = Flask(__name__)

# Database config
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///history.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

executor = ThreadPoolExecutor(max_workers=3)

with app.app_context():
    db.create_all()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/history", methods=["GET"])
def get_history():
    history = AnalysisHistory.query.order_by(AnalysisHistory.timestamp.desc()).limit(20).all()
    return jsonify([h.to_dict() for h in history])

@app.route("/api/history", methods=["DELETE"])
def clear_history():
    AnalysisHistory.query.delete()
    db.session.commit()
    return jsonify({"success": True})

def process_webhook_background(app_obj, record_id, log_text, llm_model):
    with app_obj.app_context():
        record = AnalysisHistory.query.get(record_id)
        if not record: return
        try:
            result = analyze_log_full(log_text, llm_model)
            record.response_text = result
            record.status = 'completed'
        except Exception as e:
            record.response_text = f"Error: {e}"
            record.status = 'error'
        db.session.commit()

@app.route("/api/webhook", methods=["POST"])
def webhook():
    log_text = request.form.get("log_text")
    if not log_text and "log_file" in request.files:
        file = request.files["log_file"]
        if file.filename != "":
             log_text = file.read().decode("utf-8", errors="replace")
             
    if not log_text:
        # fallback to raw text if no form data
        log_text = request.get_data(as_text=True)
    title = request.form.get("title", "CI/CD Webhook Analysis")
    llm_model = request.form.get("llm_model", "gemini-2.5-flash")

    if not log_text:
        return jsonify({"error": "No log contents provided."}), 400

    hash_input = (log_text + llm_model).encode('utf-8')
    log_hash = hashlib.md5(hash_input).hexdigest()

    cached = AnalysisHistory.query.filter_by(log_hash=log_hash, status='completed').first()
    if cached:
        return jsonify({"status": "completed", "id": cached.id}), 200

    record = AnalysisHistory(
        title=title, 
        log_hash=log_hash, 
        model_used=llm_model, 
        response_text="", 
        status="processing"
    )
    db.session.add(record)
    db.session.commit()

    executor.submit(process_webhook_background, app, record.id, log_text, llm_model)
    return jsonify({"status": "processing", "id": record.id}), 202

@app.route("/api/analyze/stream", methods=["POST"])
def analyze_stream_api():
    log_content = request.form.get("log_text", "")
    llm_model = request.form.get("llm_model", "gemini-2.5-flash")
    title = request.form.get("title", "Pasted Snippet")
    
    if not log_content and "log_file" in request.files:
        file = request.files["log_file"]
        if file.filename != "":
             log_content = file.read().decode("utf-8", errors="replace")
             title = file.filename
             
    if not log_content or not log_content.strip():
        def error_gen():
            yield f"data: {json.dumps({'error': 'Empty input provided.'})}\n\n"
        return Response(error_gen(), mimetype='text/event-stream')

    # Create hash for caching
    hash_input = (log_content + llm_model).encode('utf-8')
    log_hash = hashlib.md5(hash_input).hexdigest()

    # Check Cache
    cached_record = AnalysisHistory.query.filter_by(log_hash=log_hash).first()
    if cached_record:
        def cached_gen():
            cached_msg = '> *(Served from Cache)*\n\n' + cached_record.response_text
            yield f"data: {json.dumps({'text': cached_msg})}\n\n"
            yield "data: [DONE]\n\n"
        return Response(cached_gen(), mimetype='text/event-stream')

    app_context = app.app_context()
    
    def generate(ctx, text_content, t_title, m_model, l_hash):
        with ctx:
            full_text = ""
            try:
                for chunk in analyze_log_stream(text_content, m_model):
                    full_text += chunk
                    yield f"data: {json.dumps({'text': chunk})}\n\n"
                
                # Save to database
                record = AnalysisHistory(
                    title=t_title, 
                    log_hash=l_hash, 
                    model_used=m_model, 
                    response_text=full_text
                )
                db.session.add(record)
                db.session.commit()
                yield "data: [DONE]\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(generate(app_context, log_content, title, llm_model, log_hash), mimetype='text/event-stream')

if __name__ == "__main__":
    app.run(debug=True, port=5000, host="0.0.0.0")
