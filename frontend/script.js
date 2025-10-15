const API_URL = 'https://file-share-app-dbrm.onrender.com/api';

function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    
    if (tab === 'upload') {
        document.querySelector('.tab:first-child').classList.add('active');
        document.getElementById('upload-section').classList.add('active');
    } else {
        document.querySelector('.tab:last-child').classList.add('active');
        document.getElementById('download-section').classList.add('active');
    }
}

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

function handleFileSelect(file) {
    const maxSize = 1 * 1024 * 1024;
    
    if (file.size > maxSize) {
        showMessage('uploadMessage', 'File size exceeds 1 MB limit!', 'error');
        return;
    }

    document.getElementById('fileInfo').classList.add('show');
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = `Size: ${(file.size / 1024).toFixed(2)} KB`;
    
    window.selectedFile = file;
}

async function uploadFile() {
    const name = document.getElementById('uploadName').value.trim();
    const code = document.getElementById('uploadCode').value.trim();
    const file = window.selectedFile;

    if (!file) {
        showMessage('uploadMessage', 'Please select a file first!', 'error');
        return;
    }

    if (!name) {
        showMessage('uploadMessage', 'Please enter a name for your file!', 'error');
        return;
    }

    if (!code || code.length < 4) {
        showMessage('uploadMessage', 'Please enter a secret code (4-6 digits)!', 'error');
        return;
    }

    const uploadBtn = document.querySelector('#upload-section .btn');
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading... ⏳';

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);
        formData.append('code', code);

        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Upload failed');
        }

        showMessage('uploadMessage', 
            `✅ File "${name}" uploaded successfully! You can now access it from any device.`, 
            'success'
        );
        
        document.getElementById('uploadName').value = '';
        document.getElementById('uploadCode').value = '';
        document.getElementById('fileInfo').classList.remove('show');
        fileInput.value = '';
        window.selectedFile = null;

        updateStorageInfo();

    } catch (error) {
        showMessage('uploadMessage', `❌ ${error.message}`, 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload File 🚀';
    }
}

async function downloadFile() {
    const name = document.getElementById('downloadName').value.trim();
    const code = document.getElementById('downloadCode').value.trim();

    if (!name || !code) {
        showMessage('downloadMessage', 'Please enter both file name and secret code!', 'error');
        return;
    }

    const downloadBtn = document.querySelector('#download-section .btn');
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Searching... ⏳';

    try {
        const response = await fetch(`${API_URL}/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, code })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Download failed');
        }

        const resultDiv = document.getElementById('downloadResult');
        resultDiv.innerHTML = `
            <div class="download-item">
                <div>
                    <div class="file-name">${result.data.fileName}</div>
                    <div class="file-size">
                        ${(result.data.fileSize / 1024).toFixed(2)} KB | 
                        Uploaded: ${new Date(result.data.uploadDate).toLocaleString()}
                    </div>
                </div>
                <button class="download-btn" onclick="window.open('${result.data.downloadUrl}', '_blank')">
                    Download
                </button>
            </div>
        `;

        showMessage('downloadMessage', '✅ File found! Click the download button below.', 'success');

    } catch (error) {
        showMessage('downloadMessage', `❌ ${error.message}`, 'error');
        document.getElementById('downloadResult').innerHTML = '';
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Retrieve File 📥';
    }
}

function showMessage(elementId, message, type) {
    const msgElement = document.getElementById(elementId);
    msgElement.textContent = message;
    msgElement.className = `message ${type}`;
    
    setTimeout(() => {
        msgElement.className = 'message';
    }, 5000);
}

async function updateStorageInfo() {
    try {
        const response = await fetch(`${API_URL}/stats`);
        const stats = await response.json();

        document.getElementById('fileCount').textContent = stats.totalFiles || 0;
        document.getElementById('totalSize').textContent = stats.totalSizeKB || '0.00';
    } catch (error) {
        document.getElementById('fileCount').textContent = '0';
        document.getElementById('totalSize').textContent = '0.00';
    }
}

updateStorageInfo();