// JavaScript for Modern Web App

document.addEventListener("DOMContentLoaded", () => {
    console.log("Modern Web App Loaded!");

    // Handle file upload form validation
    const uploadForm = document.querySelector('form[action="/upload"]');
    if (uploadForm) {
        uploadForm.addEventListener("submit", (e) => {
            const customName = uploadForm.querySelector('input[name="customName"]').value.trim();
            const fileInput = uploadForm.querySelector('input[name="websiteFile"]');

            if (!customName || !fileInput.files.length) {
                e.preventDefault();
                alert("Please provide a custom name and select a file to upload.");
            }
        });
    }

    // Handle delete confirmation
    const deleteLinks = document.querySelectorAll('a[href^="/delete-website/"]');
    deleteLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
            if (!confirm("Are you sure you want to delete this website?")) {
                e.preventDefault();
            }
        });
    });

    // Dynamic card hover effect
    const cards = document.querySelectorAll(".card");
    cards.forEach((card) => {
        card.addEventListener("mouseover", () => {
            card.style.transform = "scale(1.05)";
        });
        card.addEventListener("mouseout", () => {
            card.style.transform = "scale(1)";
        });
    });
});
