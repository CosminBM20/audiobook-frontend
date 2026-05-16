Hi! I’m a master’s student and I’ve built an MVP (Minimum Viable Product) for my thesis. The project is a hybrid web platform: an audiobook store and a personal space for converting PDFs into audio format using AI.

The application is 100% fully functional end-to-end. I want you to take on the role of **Senior Software Architect & UI/UX Expert** and help me with the application audit, performance improvements, code refactoring, and suggestions for modern design.

Here is the full context of the project:
### 1. Tech Stack (Technologies Used)

- **Frontend:** Next.js (React), TypeScript, Tailwind CSS. Runs as a client-side application (components marked with `'use client'`).

- **Backend:** Node.js, Express.

- **Database & ORM:** PostgreSQL hosted on Supabase, accessed via Prisma ORM.

- **Media Storage (SaaS):** Cloudinary (for MP3 files and album covers).

- **File Processing:** `multer` (for intercepting multipart/form-data files as buffers in RAM), `pdf-extraction` (for extracting text from PDFs).

- **Text-to-Speech:** Native browser Web Speech API (zero-cost solution, runs on the client).
### 2. Architecture and Data Flow
We intentionally separated the database from the large static files:
- **Relational Data** (Users, Progress, Books, Text extracted from PDFs) is stored in PostgreSQL (Supabase).
- **Large Files** (MP3s tens of MB in size, images) are sent from the form via Node.js directly to Cloudinary via "Memory Stream," then only the secure URL link is saved in the database.
### 3. Core Features (Implemented and Functional)
1. **Authentication and Authorization:** JWT-based login, stored in `localStorage`. There is a role-based system (`USER` and `ADMIN`).

2. **Public Library (Shop):**

   - Only users with the `ADMIN` role see the button and have access to the book addition route (title, description, category, MP3, JPG).

   - On the main page, there is a grid displaying all public books, featuring a real-time search bar and category filters natively implemented in the frontend (`.filter()`).

3. **Custom Audio Player & Synchronization:**

   - A custom audio player (React `useRef` for `<audio>`) that hides the browser’s native controls.

   - **Auto-Save:** Saves listening progress (current second) to the database every 10 seconds and when the user pauses or leaves the page.

   - When the book is reopened, the player resumes playback exactly from the saved second.
4. **Hybrid Dashboard (My Books):**
   - Displays the books from the "Library" that the user has started listening to, including a visual progress bar (calculated as the current second / total duration).
   - Allows users to upload personal PDF documents.
5. **AI Text-to-Speech (PDF Processing):**

   - The backend receives the PDF, uses `pdf-extraction` to extract the raw text, applies data sanitization (removes invisible "Null Byte" characters `\0` that cause PostgreSQL to crash), and saves the text to the DB.

   - The frontend displays the list of PDFs. When the "Listen" button is pressed, `window.speechSynthesis` (Web Speech API) is triggered to read the extracted text aloud directly from the browser.
   ### What I need from you:

Given this context, please help me with the following (without disrupting the existing business logic):

1. **UI/UX:** Design suggestions to make the app look on par with premium platforms (e.g., Audible, Spotify). How could I improve the animations, contrast, typography, or visual experience of the audio player?
2. **React Optimization and Refactoring:** Where do you see potential performance issues (e.g., unnecessary rendering, inefficient use of `useEffect`) and how could I better structure the components in Next.js?
3. **Security & Backend Architecture:** Are there any visible vulnerabilities in how I send data to Cloudinary or manage JWT tokens? 
4. **Future Features (Scalability):** What "wow" features could I add to impress the thesis committee, keeping in mind that I want to keep API costs at zero?

Please provide structured feedback on these 4 points, with clear code examples where you suggest technical improvements.