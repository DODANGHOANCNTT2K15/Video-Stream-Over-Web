const express = require('express');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const app = express();

// Danh sách thư mục đã load và yêu thích
let mediaFolders = [];
let favoriteFolder = '';

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Giao diện quản lý thư mục (cho máy tính)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Giao diện mobile
app.get('/mobile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

// API lấy danh sách thư mục và thư mục yêu thích
app.get('/get-folders', (req, res) => {
    res.json({ mediaFolders, favoriteFolder });
});

// API lấy QR Code
app.get('/get-qr-code', async (req, res) => {
    try {
        const qrCodeUrl = await qrcode.toDataURL('http://192.168.137.1:3000/mobile');
        res.json({ qrCodeUrl });
    } catch (err) {
        console.error('Lỗi tạo QR Code:', err);
        res.status(500).json({ error: 'Lỗi tạo QR Code' });
    }
});

// API lưu đường dẫn thư mục yêu thích
app.post('/set-favorite-folder', (req, res) => {
    let folder = req.body.folder?.trim();
    if (!folder) {
        return res.status(400).json({ error: 'Đường dẫn trống' });
    }
    folder = folder.replace(/\\/g, '/');
    try {
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }
        favoriteFolder = folder;
        res.json({ success: true });
    } catch (err) {
        console.error('Error setting favorite folder:', err);
        res.status(500).json({ error: 'Lỗi server khi thiết lập thư mục' });
    }
});

// API lấy danh sách video yêu thích (từ thư mục yêu thích)
app.get('/favorites', (req, res) => {
    if (!favoriteFolder) {
        return res.json([]);
    }
    try {
        const files = fs.readdirSync(favoriteFolder)
            .filter((file) => /\.(mp4|mkv|mov|avi)$/i.test(file))
            .map((file) => encodeURIComponent(file));
        res.json(files);
    } catch (err) {
        console.error(`Lỗi đọc thư mục yêu thích ${favoriteFolder}:`, err);
        res.json([]);
    }
});

// API thêm/xóa video yêu thích
app.post('/toggle-favorite', (req, res) => {
    const index = req.body.index;
    let allVideos = [];

    for (const folder of mediaFolders) {
        try {
            const files = fs.readdirSync(folder)
                .filter((file) => /\.(mp4|mkv|mov|avi)$/i.test(file))
                .map((file) => ({
                    name: encodeURIComponent(file),
                    rawName: file,
                }));
            allVideos = allVideos.concat(files);
        } catch (err) {
            console.error(`Lỗi đọc thư mục ${folder}:`, err);
        }
    }

    if (index < 0 || index >= allVideos.length) {
        return res.status(400).json({ error: 'Chỉ số không hợp lệ' });
    }

    const video = allVideos[index];
    const filename = video.rawName;
    let sourcePath = null;

    for (const folder of mediaFolders) {
        const potentialPath = path.join(folder, filename);
        if (fs.existsSync(potentialPath)) {
            sourcePath = potentialPath;
            break;
        }
    }

    if (!sourcePath) {
        return res.status(404).json({ error: 'File không tồn tại' });
    }

    const destPath = path.join(favoriteFolder, filename);
    if (fs.existsSync(destPath)) {
        try {
            fs.unlinkSync(destPath);
            res.json({ success: true, added: false });
        } catch (err) {
            console.error('Lỗi xóa file yêu thích:', err);
            res.status(500).json({ error: 'Lỗi xóa file' });
        }
    } else {
        if (!favoriteFolder) {
            return res.status(400).json({ error: 'Chưa thiết lập thư mục yêu thích' });
        }
        try {
            fs.copyFileSync(sourcePath, destPath);
            res.json({ success: true, added: true });
        } catch (err) {
            console.error('Lỗi copy file yêu thích:', err);
            return res.status(500).json({ error: 'Lỗi copy file' });
        }
    }
});

// API lấy video yêu thích theo index (từ thư mục yêu thích)
app.get('/favorite-video/:index', (req, res) => {
    const index = parseInt(req.params.index, 10);
    if (!favoriteFolder) {
        return res.status(400).json({ error: 'Chưa thiết lập thư mục yêu thích' });
    }

    let favoriteFiles = [];
    try {
        favoriteFiles = fs.readdirSync(favoriteFolder)
            .filter((file) => /\.(mp4|mkv|mov|avi)$/i.test(file))
            .map((file) => ({
                name: encodeURIComponent(file),
                rawName: file,
            }));
    } catch (err) {
        console.error(`Lỗi đọc thư mục yêu thích ${favoriteFolder}:`, err);
        return res.status(500).json({ error: 'Lỗi đọc thư mục yêu thích' });
    }

    if (isNaN(index) || index < 0 || index >= favoriteFiles.length) {
        return res.status(404).json({ error: 'Video không tồn tại' });
    }

    const video = favoriteFiles[index];
    const filename = video.rawName;
    const filePath = path.join(favoriteFolder, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File không tồn tại' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;
        const file = fs.createReadStream(filePath, {
            start,
            end,
            highWaterMark: 256 * 1024,
        });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath, { highWaterMark: 256 * 1024 }).pipe(res);
    }
});

// API thêm thư mục
app.post('/add-folder', (req, res) => {
    let folder = req.body.folder?.trim();
    if (!folder) {
        return res.status(400).json({ error: 'Đường dẫn trống' });
    }
    folder = folder.replace(/\\/g, '/');
    try {
        if (fs.existsSync(folder)) {
            if (!mediaFolders.includes(folder)) {
                mediaFolders.push(folder);
                res.json({ success: true, mediaFolders });
            } else {
                res.json({ success: true, message: 'Thư mục đã tồn tại', mediaFolders });
            }
        } else {
            res.status(400).json({ error: 'Thư mục không tồn tại' });
        }
    } catch (err) {
        console.error('Error adding folder:', err);
        res.status(500).json({ error: 'Lỗi server khi kiểm tra thư mục' });
    }
});

// API xóa thư mục
app.post('/delete-folder', (req, res) => {
    const index = req.body.index;
    if (index >= 0 && index < mediaFolders.length) {
        mediaFolders.splice(index, 1);
        res.json({ success: true, mediaFolders });
    } else {
        res.status(400).json({ error: 'Chỉ số không hợp lệ' });
    }
});

// API liệt kê video
app.get('/files', (req, res) => {
    let allVideos = [];
    for (const folder of mediaFolders) {
        try {
            const files = fs.readdirSync(folder)
                .filter((file) => /\.(mp4|mkv|mov|avi)$/i.test(file))
                .map((file) => ({
                    name: encodeURIComponent(file),
                    rawName: file,
                }));
            allVideos = allVideos.concat(files);
        } catch (err) {
            console.error(`Lỗi đọc thư mục ${folder}:`, err);
        }
    }
    res.json(allVideos.map((video) => video.name));
});

// API lấy video theo index
app.get('/video/:index', (req, res) => {
    const index = parseInt(req.params.index, 10);
    let allVideos = [];

    for (const folder of mediaFolders) {
        try {
            const files = fs.readdirSync(folder)
                .filter((file) => /\.(mp4|mkv|mov|avi)$/i.test(file))
                .map((file) => ({
                    name: encodeURIComponent(file),
                    rawName: file,
                }));
            allVideos = allVideos.concat(files);
        } catch (err) {
            console.error(`Lỗi đọc thư mục ${folder}:`, err);
        }
    }

    if (isNaN(index) || index < 0 || index >= allVideos.length) {
        return res.status(404).json({ error: 'Video không tồn tại' });
    }

    const video = allVideos[index];
    const filename = video.rawName;
    let filePath = null;

    for (const folder of mediaFolders) {
        const potentialPath = path.join(folder, filename);
        if (fs.existsSync(potentialPath)) {
            filePath = potentialPath;
            break;
        }
    }

    if (!filePath) {
        return res.status(404).json({ error: 'File không tồn tại' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;
        const file = fs.createReadStream(filePath, {
            start,
            end,
            highWaterMark: 256 * 1024,
        });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath, { highWaterMark: 256 * 1024 }).pipe(res);
    }
});

// Khởi động server
app.listen(3000, '0.0.0.0', () => {
    console.log('Server chạy tại http://localhost:3000');
    console.log('Điện thoại truy cập qua: http://192.168.137.1:3000/mobile');
});