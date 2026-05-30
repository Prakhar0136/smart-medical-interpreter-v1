# backend/interpreter.py
import sys
import json
import re
import warnings
import os
import fitz  # PyMuPDF for PDF handling
import easyocr
import google.generativeai as genai

# Suppress PyTorch/EasyOCR user warnings
warnings.filterwarnings("ignore", category=UserWarning)

def apply_privacy_shield(text):
    """Redacts PII from the raw text."""
    email_pattern = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
    phone_pattern = r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
    ssn_pattern = r'\d{3}-\d{2}-\d{4}'
    
    redacted_text = re.sub(email_pattern, '[REDACTED EMAIL]', text)
    redacted_text = re.sub(phone_pattern, '[REDACTED PHONE]', redacted_text)
    redacted_text = re.sub(ssn_pattern, '[REDACTED SSN]', redacted_text)
    return redacted_text

def analyze_medical_metrics(safe_text):
    """Sends the sanitized text to Gemini with strict JSON formatting rules, medical guardrails, and nomenclature normalization."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is missing.")
        
    genai.configure(api_key=api_key)
    
    model = genai.GenerativeModel(
        'gemini-2.5-flash',
        generation_config={"response_mime_type": "application/json"}
    )
    
    prompt = f"""
    You are an Elite Medical Interpreter AI. Your task is to extract biomarkers from unstructured, redacted medical reports.
    
    NOMENCLATURE STANDARDIZATION RULE:
    You must map variant biomarker names to their clean, standardized, Title Case canonical forms so that historical graphs do not break.
    Examples of mappings:
    - "Fasting Blood Sugar", "GLUCOSE, FASTING", "Glucose, Serum" -> "Glucose"
    - "Hemoglobin A1c", "HbA1c", "A1C Glycohemoglobin" -> "HbA1c"
    - "Total Cholesterol", "Cholesterol, Total" -> "Total Cholesterol"
    - "Low Density Lipoprotein", "LDL CHOL", "LDL-C" -> "LDL Cholesterol"
    - "High Density Lipoprotein", "HDL CHOL", "HDL-C" -> "HDL Cholesterol"
    - "Triglycerides", "TRIG" -> "Triglycerides"
    
    CRITICAL GUARDRAILS:
    1. DO NOT diagnose any diseases or conditions.
    2. Remind the user in the explanation that you are an AI and they must consult a doctor.
    3. If a metric lacks a clear 'Normal/High/Low' indicator in the text, infer it strictly based on standard medical baselines, but do not alarm the patient.
    4. Ensure values are purely numeric strings (e.g., "95", not "95 mg/dL"). Strip extraneous characters from the value field.
    
    TEXT TO ANALYZE:
    {safe_text}
    
    OUTPUT FORMAT (Strict JSON):
    {{
      "biomarkers": [
        {{
          "name": "Standardized Title Case Name (e.g., Glucose, HbA1c, Total Cholesterol)",
          "value": "Numeric Value Only",
          "unit": "Unit (e.g., mg/dL, %)",
          "status": "Normal, High, or Low"
        }}
      ],
      "explanation": "A jargon-free, empathetic 2-sentence summary of what these metrics broadly measure.",
      "questions_for_doctor": [
        "Question 1",
        "Question 2",
        "Question 3"
      ]
    }}
    """
    
    response = model.generate_content(prompt)
    return json.loads(response.text)

def main():
    try:
        if len(sys.argv) < 2:
            raise ValueError("No file path provided.")
        
        file_path = sys.argv[1]
        raw_text = ""
        
        # 1. Extraction (Hybrid PDF/OCR Engine)
        if file_path.lower().endswith('.pdf'):
            doc = fitz.open(file_path)
            for page in doc:
                text = page.get_text()
                if len(text.strip()) > 50:
                    # Native digital PDF, extract text directly
                    raw_text += text + " "
                else:
                    # Scanned PDF detected, render page to image and use OCR
                    pix = page.get_pixmap()
                    temp_img_path = f"temp_ocr_{page.number}.png"
                    pix.save(temp_img_path)
                    
                    reader = easyocr.Reader(['en'], gpu=False, verbose=False)
                    ocr_result = reader.readtext(temp_img_path, detail=0)
                    raw_text += " ".join(ocr_result) + " "
                    
                    if os.path.exists(temp_img_path):
                        os.remove(temp_img_path)
        else:
            # Standard Image Upload
            reader = easyocr.Reader(['en'], gpu=False, verbose=False)
            ocr_result = reader.readtext(file_path, detail=0)
            raw_text = " ".join(ocr_result)
        
        # 2. Privacy Shield
        safe_text = apply_privacy_shield(raw_text)
        
        # 3. LLM Analysis
        structured_data = analyze_medical_metrics(safe_text)
        
        output_payload = {
            "status": "success",
            "extracted_character_count": len(safe_text),
            "analysis": structured_data
        }
        
        print(json.dumps(output_payload))
        sys.exit(0)
        
    except Exception as e:
        error_payload = {
            "status": "error",
            "error_message": str(e)
        }
        print(json.dumps(error_payload))
        sys.exit(1)

if __name__ == "__main__":
    main()