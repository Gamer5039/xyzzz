const express = require("express");
const session = require("express-session");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const unzipper = require("unzipper");

const app = express();
const PORT = 3000;
const USERS_FILE = path.join(__dirname, "users.json");
const WEBSITES_FILE = path.join(__dirname, "websites.json");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'mysecret', // Secret key for session encryption
    resave: false,
    saveUninitialized: true,
}));

// Serve static files from the "websites" folder
app.use("/websites", express.static(path.join(__dirname, "websites")));

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, "public")));


// Ensure "uploads" and "websites" directories exist
const ensureDirectory = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};
ensureDirectory("uploads");
ensureDirectory("websites");

// Multer setup for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads"),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Middleware to check if user is logged in
const isLoggedIn = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }
    next();
};

// Function to load users from the file
const loadUsers = () => {
    if (fs.existsSync(USERS_FILE)) {
        const data = fs.readFileSync(USERS_FILE);
        return JSON.parse(data);
    } else {
        return [];
    }
};

// Function to save users to the file
const saveUsers = (users) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// Function to load websites for users from the file
const loadWebsites = () => {
    if (fs.existsSync(WEBSITES_FILE)) {
        const data = fs.readFileSync(WEBSITES_FILE);
        return JSON.parse(data);
    } else {
        return {};
    }
};

// Function to save websites to the file
const saveWebsites = (websites) => {
    fs.writeFileSync(WEBSITES_FILE, JSON.stringify(websites, null, 2));
};

// Serve Homepage
app.get("/", (req, res) => {
    if (req.session.user) {
        const websites = loadWebsites()[req.session.user.username] || [];
        const websiteList = websites.map(site => `
            <div class="website-item">
                <a href="/websites/${site}/index.html">Visit ${site}</a>
                <a href="/edit-website/${site}">Edit ${site}</a>
                <a href="/delete-website/${site}">Delete ${site}</a>
                <a href="/rename-website/${site}">Rename ${site}</a>
            </div>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>RR Website Manager</title>
                <link rel="stylesheet" href="/css/style.css">
            </head>
            <body>
                <header class="header">
                    <div class="container">
                        <h1>RR Website Manager</h1>
                        <nav>
                            <a href="/">Home</a>
                            <a href="/logout">Logout</a>
                        </nav>
                    </div>
                </header>

                <main class="main-content">
                    <section class="dashboard">
                        <h2>Welcome, ${req.session.user.username}</h2>
                        <h3>Your Websites</h3>
                        <div class="website-list">
                            ${websiteList}
                        </div>

                        <h3>Upload a New Website</h3>
                        <form action="/upload" method="post" enctype="multipart/form-data" class="upload-form">
                            <input type="text" name="customName" placeholder="Custom Website Name" required />
                            <input type="file" name="websiteFile" required />
                            <button type="submit" class="btn">Upload</button>
                        </form>
                    </section>
                </main>

                <footer>
                    <p>&copy; 2024 RR Website Manager</p>
                </footer>
            </body>
            </html>
        `);
    } else {
        res.redirect("/login");
    }
});


// Login Route
app.get("/login", (req, res) => {
    res.send(`
        <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="/css/style.css">
            </head>
        <div class="auth-container">
    <div class="auth-box">
        <h1>Login</h1>
        <form action="/login" method="post">
            <input type="text" name="username" placeholder="Username" required />
            <input type="password" name="password" placeholder="Password" required />
            <button type="submit">Login</button>
        </form>
        <p>Don't have an account? <a href="/signup">Sign up here</a></p>
    </div>
</div>

    `);
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const users = loadUsers();
    const user = users.find(u => u.username === username);
    
    if (!user) {
        return res.send("User not found!");
    }

    if (bcrypt.compareSync(password, user.password)) {
        req.session.user = user;
        res.redirect("/");
    } else {
        res.send("Incorrect password!");
    }
});

// Signup Route
app.get("/signup", (req, res) => {
    res.send(`
             <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="/css/style.css">
            </head>
  <div class="auth-container">
    <div class="auth-box">
        <h1>Signup</h1>
        <form action="/signup" method="post">
            <input type="text" name="username" placeholder="Username" required />
            <input type="password" name="password" placeholder="Password" required />
            <button type="submit">Create Account</button>
        </form>
    </div>
</div>

    `);
});

app.post("/signup", (req, res) => {
    const { username, password } = req.body;
    const users = loadUsers();
    const existingUser = users.find(u => u.username === username);

    if (existingUser) {
        return res.send("User already exists!");
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = { username, password: hashedPassword };
    users.push(newUser);
    saveUsers(users);

    const websites = loadWebsites();
    websites[username] = []; // Initialize empty array for websites
    saveWebsites(websites);

    res.send("Account created! <a href='/login'>Login here</a>");
});

// File Upload Route
app.post("/upload", isLoggedIn, upload.single("websiteFile"), (req, res) => {
    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const customName = req.body.customName.replace(/\s+/g, "-").toLowerCase();
    const targetFolder = path.join(__dirname, "websites", customName);

    if (fs.existsSync(targetFolder)) {
        fs.unlinkSync(filePath); // Delete uploaded file
        return res.send("Custom name already exists! Try a different name.");
    }

    ensureDirectory(targetFolder);

    if (fileExt === ".html") {
        fs.renameSync(filePath, path.join(targetFolder, "index.html"));
        const websites = loadWebsites();
        websites[req.session.user.username].push(customName);
        saveWebsites(websites);
        res.send(`Website uploaded! <a href="/websites/${customName}/index.html">Visit your site</a>`);
    } else if (fileExt === ".zip") {
        fs.createReadStream(filePath)
            .pipe(unzipper.Extract({ path: targetFolder }))
            .on("close", () => {
                fs.unlinkSync(filePath); // Remove ZIP file after extraction
                const websites = loadWebsites();
                websites[req.session.user.username].push(customName);
                saveWebsites(websites);
                res.send(`Website uploaded! <a href="/websites/${customName}/index.html">Visit your site</a>`);
            });
    } else {
        fs.unlinkSync(filePath); // Delete unsupported files
        res.send("Only HTML or ZIP files are allowed!");
    }
});

// Edit Website Route
app.get("/edit-website/:siteName", isLoggedIn, (req, res) => {
    const websiteName = req.params.siteName;
    const websites = loadWebsites()[req.session.user.username];

    if (!websites || !websites.includes(websiteName)) {
        return res.send("You don't own this website.");
    }

    res.send(`
        <h1>Edit Website - ${websiteName}</h1>
        <form action="/edit-website/${websiteName}" method="post" enctype="multipart/form-data">
            <input type="file" name="websiteFile" required />
            <button type="submit">Update Website</button>
        </form>
    `);
});

app.post("/edit-website/:siteName", isLoggedIn, upload.single("websiteFile"), (req, res) => {
    const websiteName = req.params.siteName;
    const websites = loadWebsites()[req.session.user.username];

    if (!websites || !websites.includes(websiteName)) {
        return res.send("You don't own this website.");
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const targetFolder = path.join(__dirname, "websites", websiteName);

    if (fileExt === ".html") {
        fs.renameSync(filePath, path.join(targetFolder, "index.html"));
    } else if (fileExt === ".zip") {
        fs.rmdirSync(targetFolder, { recursive: true }); // Remove old website files
        fs.createReadStream(filePath)
            .pipe(unzipper.Extract({ path: targetFolder }))
            .on("close", () => {
                fs.unlinkSync(filePath); // Remove ZIP file after extraction
                res.send(`Website updated! <a href="/websites/${websiteName}/index.html">Visit your site</a>`);
            });
    } else {
        fs.unlinkSync(filePath); // Delete unsupported files
        res.send("Only HTML or ZIP files are allowed!");
    }
});

// Rename Website Route
app.get("/rename-website/:siteName", isLoggedIn, (req, res) => {
    const websiteName = req.params.siteName;
    const websites = loadWebsites()[req.session.user.username];

    if (!websites || !websites.includes(websiteName)) {
        return res.send("You don't own this website.");
    }

    res.send(`
        <h1>Rename Website - ${websiteName}</h1>
        <form action="/rename-website/${websiteName}" method="post">
            <input type="text" name="newName" placeholder="New name" required />
            <button type="submit">Rename Website</button>
        </form>
    `);
});

app.post("/rename-website/:siteName", isLoggedIn, (req, res) => {
    const websiteName = req.params.siteName;
    const newName = req.body.newName.replace(/\s+/g, "-").toLowerCase();
    const websites = loadWebsites()[req.session.user.username];

    if (!websites || !websites.includes(websiteName)) {
        return res.send("You don't own this website.");
    }

    const targetFolder = path.join(__dirname, "websites", websiteName);
    const newFolder = path.join(__dirname, "websites", newName);

    if (fs.existsSync(newFolder)) {
        return res.send("New name already exists.");
    }

    fs.renameSync(targetFolder, newFolder);
    const updatedWebsites = websites.map(site => site === websiteName ? newName : site);
    saveWebsites({ [req.session.user.username]: updatedWebsites });

    res.send(`Website renamed! <a href="/websites/${newName}/index.html">Visit your site</a>`);
});

// Delete Website Route
app.get("/delete-website/:siteName", isLoggedIn, (req, res) => {
    const websiteName = req.params.siteName;
    const websites = loadWebsites()[req.session.user.username];

    if (!websites || !websites.includes(websiteName)) {
        return res.send("You don't own this website.");
    }

    const targetFolder = path.join(__dirname, "websites", websiteName);
    fs.rmdirSync(targetFolder, { recursive: true });

    const updatedWebsites = websites.filter(site => site !== websiteName);
    saveWebsites({ [req.session.user.username]: updatedWebsites });

    res.send("Website deleted!");
});

// Logout Route
app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.send("Error logging out!");
        }
        res.redirect("/login");
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
