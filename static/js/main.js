document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");
    const fileInfo = document.getElementById("file-info");
    const fileNameDisplay = document.getElementById("file-name");
    const logTextInput = document.getElementById("log-text-input");
    const analyzeBtn = document.getElementById("analyze-btn");
    
    const inputSection = document.getElementById("input-section");
    const resultSection = document.getElementById("result-section");
    const markdownOutput = document.getElementById("markdown-output");
    const downloadBtn = document.getElementById("download-btn");
    const copyBtn = document.getElementById("copy-btn");
    const topLoader = document.getElementById("top-loader");
    const modelSelect = document.getElementById("model-select");
    
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    const historyList = document.getElementById("history-list");
    const clearHistoryBtn = document.getElementById("clear-history-btn");

    let selectedFile = null;
    let isStreaming = false;
    let fullMarkdownText = "";
    
    // Config marked JS to use highlight js
    marked.setOptions({
        highlight: function(code, lang) {
            const language = highlight.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
        langPrefix: 'hljs language-'
    });

    // --- Tab Switching Logic ---
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));
            
            btn.classList.add("active");
            document.getElementById(btn.dataset.target).classList.add("active");
            checkReadyState();
        });
    });

    // --- Drag and Drop Logic ---
    dropZone.addEventListener("click", () => fileInput.click());

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add("dragover"), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove("dragover"), false);
    });

    dropZone.addEventListener("drop", (e) => handleFileSelection(e.dataTransfer.files[0]));
    fileInput.addEventListener("change", function() { handleFileSelection(this.files[0]); });

    function handleFileSelection(file) {
        if (file) {
            selectedFile = file;
            fileNameDisplay.textContent = file.name;
            fileInfo.classList.remove("hidden");
            checkReadyState();
        }
    }
    
    logTextInput.addEventListener("input", checkReadyState);

    function checkReadyState() {
        const activeTab = document.querySelector(".tab-content.active").id;
        if (activeTab === "upload-tab" && selectedFile) {
            analyzeBtn.disabled = false;
        } else if (activeTab === "paste-tab" && logTextInput.value.trim().length > 0) {
            analyzeBtn.disabled = false;
        } else {
            analyzeBtn.disabled = true;
        }
    }

    // --- Analysis via Server-Sent Events ---
    analyzeBtn.addEventListener("click", async () => {
        if (analyzeBtn.disabled || isStreaming) return;
        
        isStreaming = true;
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = "Analyzing...";
        
        // Show indeterminate progress loader
        topLoader.classList.remove("done");
        topLoader.classList.add("loading");
        
        resultSection.classList.remove("hidden");
        markdownOutput.innerHTML = "";
        fullMarkdownText = "";
        
        const activeTab = document.querySelector(".tab-content.active").id;
        const formData = new FormData();
        let analysisTitle = "Log Analysis";
        
        if (activeTab === "upload-tab") {
            formData.append("log_file", selectedFile);
            analysisTitle = selectedFile.name;
        } else {
            formData.append("log_text", logTextInput.value);
            analysisTitle = "Pasted Snippet";
        }
        
        formData.append("llm_model", modelSelect.value);
        formData.append("title", analysisTitle);

        try {
            const response = await fetch("/api/analyze/stream", {
                method: "POST",
                body: formData
            });

            if (!response.ok) throw new Error("Network response was not ok");

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6);
                        if (dataStr === '[DONE]') {
                            break;
                        }
                        try {
                            const dataObj = JSON.parse(dataStr);
                            if (dataObj.error) {
                                fullMarkdownText += `\n\n**Error:** ${dataObj.error}`;
                            } else if (dataObj.text) {
                                fullMarkdownText += dataObj.text;
                                markdownOutput.innerHTML = marked.parse(fullMarkdownText);
                            }
                        } catch (e) {
                            console.error("Error parsing JSON chunk", e, dataStr);
                        }
                    }
                }
            }
            
            // Refresh history from server after successful analysis
            loadHistory();
            
        } catch (err) {
            markdownOutput.innerHTML = `<h3 style="color:#ff5f56">Analysis Failed</h3><p>${err.message}</p>`;
        }
        
        // Finish Status
        isStreaming = false;
        analyzeBtn.textContent = "Analyze Issue";
        checkReadyState();
        
        topLoader.classList.remove("loading");
        topLoader.classList.add("done");
    });

    // --- Action Buttons ---
    downloadBtn.addEventListener("click", () => {
        if (!fullMarkdownText) return;
        const blob = new Blob([fullMarkdownText], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "analysis_report.md";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(fullMarkdownText).then(() => {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied`;
            copyBtn.style.color = '#10b981';
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.style.color = '';
            }, 2000);
        });
    });

    // --- Action Buttons End ---
            
    // --- History Logic (Backend) ---
    let lastHistoryJson = "";
    
    async function loadHistory() {
        try {
            const res = await fetch('/api/history');
            const historyText = await res.text();
            
            if (historyText === lastHistoryJson) {
                return; // Prevent UI jumping if nothing changed
            }
            lastHistoryJson = historyText;
            const history = JSON.parse(historyText);
            
            historyList.innerHTML = '';
            
            if (history.length === 0) {
                historyList.innerHTML = '<li class="history-empty">No history.</li>';
                return;
            }
            
            history.forEach((item) => {
                const li = document.createElement('li');
                li.className = 'history-item';
                const dateStr = new Date(item.timestamp).toLocaleString();
                
                let titleHtml = `<h4>${item.title} <span style="font-size:10px;color:#888;font-weight:400;margin-left:5px;">${item.model_used.includes('flash')?'Flash':'Pro'}</span></h4>`;
                
                if (item.status === 'processing') {
                   titleHtml += `<div style="font-size:12px; color:#fbbf24; margin-top:4px;">⏳ Processing API...</div>`;
                } else if (item.status === 'error') {
                   titleHtml += `<div style="font-size:12px; color:#ff5f56; margin-top:4px;">❌ Error processing</div>`;
                }

                li.innerHTML = `
                    ${titleHtml}
                    <span>${dateStr}</span>
                `;
                
                li.addEventListener('click', () => {
                    document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
                    li.classList.add('active');
                    
                    if (item.status === 'processing') {
                         markdownOutput.innerHTML = "<em>This build log is still being analyzed by the LLM in the background. Please wait...</em>";
                         return;
                    }
                    
                    resultSection.classList.remove("hidden");
                    fullMarkdownText = item.text;
                    markdownOutput.innerHTML = marked.parse(fullMarkdownText || "");
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                });
                
                historyList.appendChild(li);
            });
        } catch (e) {
            console.error("Failed to load history", e);
        }
    }
    
    // Poll every 5 seconds for updates (useful for webhooks)
    setInterval(loadHistory, 5000);
    
    clearHistoryBtn.addEventListener('click', async () => {
        if (!confirm("Are you sure you want to clear all history?")) return;
        await fetch('/api/history', { method: 'DELETE' });
        loadHistory();
        resultSection.classList.add("hidden");
        fullMarkdownText = "";
        markdownOutput.innerHTML = "";
    });

    // Init
    loadHistory();
    
    // New UX: focus paste tab text area if clicked
    document.querySelector('[data-target="paste-tab"]').addEventListener('click', () => {
        setTimeout(() => logTextInput.focus(), 50);
    });
});
