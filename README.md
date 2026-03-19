# Birthday Timeline & Memory Slideshow

A beautiful, vintage-inspired interactive timeline and slideshow built for Jury's birthday. This application allows you to create, edit, and share a chronological journey of memories.

## Features

- **Interactive Timeline:** Scroll through a beautifully styled vertical timeline of memories.
- **Slideshow Mode:** View memories in a full-screen, immersive slideshow with smooth transitions.
- **Admin Controls:**
  - **Add/Delete Memories:** Manage the timeline content directly in the app.
  - **Edit Text:** Update titles and descriptions on the fly.
  - **Photo Uploads:** Replace placeholder images with your own photos.
- **Cloud Sync:** Powered by Firebase Firestore for real-time data persistence.
- **Export Options:** Download the entire timeline as a high-quality image or download all photos as a ZIP archive.

## Tech Stack

- **Frontend:** React 19, Vite, TypeScript
- **Styling:** Tailwind CSS
- **Animations:** Motion (formerly Framer Motion)
- **Icons:** Lucide React
- **Backend:** Firebase (Authentication & Firestore)
- **Utilities:** html2canvas, JSZip, file-saver

## Setup & Deployment

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd <repo-name>
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Create a `.env` file in the root directory and add your Firebase configuration:
   ```env
   GOOGLE_MAPS_PLATFORM_KEY=your_key_here
   # Firebase config is handled via firebase-applet-config.json in this environment
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

## License

Apache-2.0
