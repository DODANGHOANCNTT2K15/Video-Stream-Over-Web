# 🔗 Local Video Streaming Server over Hotspot

A simple Node.js-based local streaming server that allows you to share and watch videos stored on your computer through a mobile-friendly interface. Designed for offline usage via personal Wi-Fi hotspot — no internet required.

## 📱 Features

- ✅ Stream videos (MP4, MKV, MOV, AVI) from your PC to any device on the same network
- ✅ Mobile interface accessible via QR code
- ✅ Add or remove media folders
- ✅ Mark videos as favorites
- ✅ Stream videos with support for seeking (via HTTP Range headers)
- ✅ No external dependencies or cloud services — **runs entirely locally**

## 🛠 Folder Structure
.
├── server.js                # Main server
├── public/
│   ├── index.html          # Desktop UI
│   └── mobile.html         # Mobile UI

## 📦 Libraries Used

- Express
- QR Code
- Node.js FS
- Path

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or newer recommended)
- Videos stored locally on your computer

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```
2. Install dependencies
```bash
npm install
```
3.  Start the server
```bash
node server.js
```
4.  On your computer, open:
  👉 http://localhost:3000
5.  On your moblie device connected to samce hostpot, scan the QR code or go to:
  👉 http://192.168.137.1:3000/mobile
