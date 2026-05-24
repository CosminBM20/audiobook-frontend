'use client';

import React, {
  createContext, useContext, useState,
  useEffect, useCallback, useMemo,
} from 'react';

// ── Dictionary ────────────────────────────────────────────────────────────────
// Add new keys to BOTH locales. TypeScript will error if they diverge.

export const dict = {
  ro: {
    // Header
    searchPlaceholder : 'Caută cărți, autori...',
    notifications     : 'Notificări',
    newInLibrary      : 'Nou în bibliotecă',
    noNotifications   : 'Nicio notificare',
    loading           : 'Se încarcă…',
    clearAll          : 'Șterge tot',
    seeFullLibrary    : 'Vezi toată librăria →',
    // Sidebar
    library           : 'Librărie',
    mySpace           : 'Spațiul meu',
    adminPanel        : 'Panou Admin',
    logout            : 'Deconectare',
    // Home
    sortDefault       : 'Default',
    sortTitle         : 'A–Z',
    sortAuthor        : 'Autor',
    sortDuration      : 'Durată',
    noBooksFound      : 'Nicio carte găsită',
    tryAnotherSearch  : 'Încearcă o altă căutare sau categorie',
    continueListening : 'Continuă ascultarea',
    resume            : 'Reia',
    // Category / Language filters (Home)
    allCategories     : 'Toate',
    allLanguages      : 'Toate',
    langRo            : 'Română',
    langEn            : 'English',
    // Player
    play              : 'Redă',
    pause             : 'Pauză',
    back15            : 'Înapoi 15 secunde',
    forward15         : 'Înainte 15 secunde',
    sleepTimer        : 'Somn',
    prevChapter       : 'Capitol anterior',
    nextChapter       : 'Capitol următor',
    bookmarks         : 'Marcaje',
    addBookmark       : 'Adaugă',
    noBookmarks       : 'Niciun marcaj',
    noBookmarksHint   : 'Adaugă unul la poziția curentă.',
    chapters          : 'Capitole',
    nowPlaying        : 'Redare în curs',
    // Sidebar progress widget
    annualGoal        : 'Obiectiv anual',
    outOf             : 'din',
    booksCompletedOf  : 'cărți completate',
    book              : 'carte',
    books             : 'cărți',
    // Admin — page header & stats
    adminSubtitle     : 'Gestionează biblioteca de audiobook-uri',
    statsBooks        : 'Cărți',
    statsCategories   : 'Categorii',
    statsTotalHours   : 'Ore totale',
    adminLibraryTab   : 'Bibliotecă',
    // Admin — shared labels
    addBook           : 'Adaugă carte',
    back              : 'Înapoi',
    bookTitle         : 'Titlul cărții',
    author            : 'Autor',
    category          : 'Categorie',
    description       : 'Descriere',
    cover             : 'Copertă',
    saving            : 'Se salvează...',
    processing        : 'Se procesează...',
    areYouSure        : 'Ești sigur?',
    confirmDelete     : 'Da, șterge',
    // Admin — library tab
    noBooksInLibrary  : 'Nu există cărți în bibliotecă.',
    addFirstBook      : 'Adaugă prima carte',
    // Admin — edit form
    editBookTitle     : 'Editează',
    keepCurrentCover  : 'Lasă gol pentru a păstra coperta actuală',
    // Admin — add form
    bookDetails       : 'Detalii carte',
    bookDetailsDesc   : 'Informațiile de bază care apar în librărie',
    durationAuto      : '⏱ Durata este detectată automat din fișierul audio.',
    descPlaceholder   : 'O scurtă descriere a cărții...',
    coverDesc         : 'Imaginea de copertă stocată pe Cloudinary',
    coverLabel        : 'Copertă (.jpg / .png / .webp)',
    uploadNotice      : 'Fișierele audio mari pot dura 1–3 minute la upload (Cloudinary free tier). Pagina rămâne activă.',
    audioChapters     : 'Capitole audio',
    chaptersDesc      : 'Adaugă unul sau mai multe capitole. Ordinea din listă este ordinea de redare.',
    chapterWord       : 'Capitol',
    chapterSingular   : 'capitol',
    chapterPlural     : 'capitole',
    addChapter        : 'Adaugă capitol',
    uploadingCloud    : 'Se încarcă pe Cloudinary…',
    finalizing        : 'Se finalizează…',
    publishedSuccess  : 'Publicat cu succes!',
    publish           : 'Publică Audiobook-ul',
    saveChanges       : 'Salvează modificările',
    cancel            : 'Anulează',
    // Book language labels (used in admin selects + filter)
    bookLanguage      : 'Limba cărții',
    romanian          : 'Română',
    english           : 'Engleză',
    // Home — favorites filter
    myFavorites       : 'Favorite mele',
    // Dashboard — page
    dashSubtitle      : 'Statisticile tale, progresul în librărie și documentele personale',
    // Dashboard — stat cards
    totalListened     : 'Total ascultat',
    booksStartedStat  : 'Cărți începute',
    booksCompleted    : 'Finalizate',
    favoriteCategory  : 'Categorie preferată',
    // Dashboard — activity chart
    weeklyActivity    : 'Activitate săptămânală',
    booksListened7Days: 'Cărți ascultate în ultimele 7 zile',
    // Dashboard — challenges
    challenges        : 'Provocări',
    challengesAdmin   : 'Gestionare Provocări',
    doneBadge         : '✓ Gata',
    ch1Label          : 'Primul Pas',
    ch1Desc           : 'Completează prima carte audio',
    ch2Label          : 'Cititor Avid',
    ch2Desc           : 'Completează 5 cărți audio',
    ch3Label          : 'Maratonist',
    ch3Desc           : 'Ascultă cel puțin 5 ore total',
    ch4Label          : 'Explorator',
    ch4Desc           : 'Explorează 3 categorii diferite',
    ch5Label          : 'Săptămâna Activă',
    ch5Desc           : 'Fii activ 5 din ultimele 7 zile',
    categoryUnit      : 'categorie',
    categoriesUnit    : 'categorii',
    daysUnit          : 'zile',
    // Dashboard — listen later
    listenLaterSection: 'Ascultă mai târziu',
    // Dashboard — continue listening empty state
    noBookStarted     : 'Nu ai început nicio carte',
    exploreLibraryHint: 'Explorează librăria pentru a găsi prima ta carte',
    exploreLibraryBtn : 'Explorează librăria',
    // Dashboard — documents section
    myDocuments       : 'Documentele mele',
    howItWorksTitle   : 'Cum funcționează documentele personale?',
    how1a             : 'Încarcă',
    how1Bold          : 'notițe de curs',
    how1b             : ', articole sau rapoarte în format PDF cu text selectabil.',
    how2a             : 'Textul este extras și poate fi',
    how2Bold          : 'ascultat cu voce sintetizată',
    how2b             : ' — ideal pentru studiu fără ecran.',
    how3a             : '',
    how3Bold          : 'Rezumatul rapid',
    how3b             : ' apare în sub o secundă, fără descărcări.',
    how4a             : '',
    how4Bold          : 'Modelul neural',
    how4b             : ' (~40 MB, descărcat o singură dată) produce un rezumat mai rafinat în 1–2 minute.',
    howWarning        : 'Scanările și documentele scrise de mână nu sunt suportate — este necesară prezența textului selectabil în PDF.',
    uploadNewDoc      : 'Încarcă document nou',
    docTitleLabel     : 'Titlu document',
    pdfFileLabel      : 'Fișier PDF',
    uploadBtn         : 'Încarcă',
    noDocUploaded     : 'Niciun document încărcat',
    addFirstPdfHint   : 'Folosește formularul de mai sus pentru a adăuga primul tău PDF',
    listenAction      : 'Ascultă',
    stopAction        : 'Oprește',
    pauseAction       : 'Pauză',
    resumeAction      : 'Continuă',
    summarizeAction   : 'Rezumă',
    regenerateAction  : 'Regenerează',
    quickSummaryBadge : 'Rapid',
    neuralSummaryTitle: 'Rezumat Neural AI',
    quickSummaryTitle : 'Rezumat Rapid',
    upgradingToNeural : 'Se îmbunătățește…',
    // Player — sleep timer
    cancelTimer       : 'Anulează timer',
    // Dashboard — PredictiveInsights
    advancedStats     : 'Statistici Avansate',
    listeningPace     : 'Ritm de ascultare',
    notEnoughData     : 'Prea puține date — ascultă mai mult!',
    perDayAvg         : 'pe zi în medie',
    daysInARow        : 'zile la rând',
    categoryDistrib   : 'Distribuție categorii',
    timeByGenre       : 'Timp ascultat pe gen',
    completionPred    : 'Predicție finalizare',
    basedOnPace       : 'Bazat pe ritmul tău actual de ascultare',
    unknownDate       : 'Dată necunoscută',
    // Dashboard — toast messages (previously hardcoded Romanian)
    errLoadData       : 'Eroare la încărcarea datelor.',
    errNoPdf          : 'Selectează un fișier PDF!',
    pdfSaved          : 'PDF procesat și salvat!',
    errUpload         : 'Eroare la încărcare.',
    errConnection     : 'Eroare de conexiune.',
    errLoadContent    : 'Eroare la încărcarea conținutului.',
    removedFromLater  : 'Eliminat din lista de ascultare.',
    docDeleted        : 'Document șters.',
    errDelete         : 'Eroare la ștergere.',
    errContentUnavail : 'Conținut indisponibil.',
    errAiUnavail      : 'Funcția AI nu este disponibilă.',
    errSummaryGenerate: 'Eroare la generarea rezumatului.',
    errWorkerInternal : 'Eroare internă worker AI.',
    // Dashboard — AI worker status strings (rendered inside the card body)
    quickSummaryDone  : 'Rezumat rapid gata. Îmbunătățește cu AI…',
    aiInitializing    : 'Inițializează…',
    // Dashboard — inline labels that previously bypassed t()
    searchDocs        : 'Caută document…',
    selectedFile      : 'Fișier selectat:',
    deleteDoc         : 'Șterge document',
    docTitlePlaceholder: 'ex: Curs Algoritmi — S3',
    // Player page — toasts, labels, hints
    sleepTimerFired   : 'Timer de somn activat!',
    bookmarkAdded     : 'Marcaj adăugat!',
    errBookmarkAdd    : 'Eroare la adăugarea marcajului.',
    errGeneric        : 'Eroare.',
    backToLibrary     : 'Librărie',
    bookmarkAt        : 'Marcaj la',
    deleteBookmark    : 'Șterge marcaj',
    keyboardHint      : 'Spațiu = Play · ← → = 15s · M = Mute',
    bookCompleted     : 'Complet',
    // Dashboard — streak widget
    streakTitle          : 'Streak de ascultare',
    streakStart          : 'Ascultă azi pentru a începe un streak!',
    streakDay1           : '1 zi consecutivă — continuă!',
    streakNDays          : 'zile consecutive',
    streakRecord         : 'Record personal:',
    streakFire           : '🔥 În flăcări',
    // Dashboard — XP / level widget
    levelLabel           : 'Nivel',
    xpAccumulated        : 'XP acumulat',
    nextLevelAbbr        : 'Niv.',
    // Dashboard — personal docs sub-section
    personalDocsSection  : 'Documente personale',
    // Profile page
    profilePersonalInfo  : 'Informații personale',
    profileChangePassword: 'Schimbă parola',
    nameLabel            : 'Nume',
    saveInfoBtn          : 'Salvează informații',
    currentPasswordLabel : 'Parola curentă',
    newPasswordLabel     : 'Parolă nouă',
    confirmPasswordLabel : 'Confirmă parola',
    challengesCompletedSuffix: ' provocări completate',
    errLoadProfile       : 'Eroare la încărcarea profilului.',
    profileUpdated       : 'Informații actualizate cu succes!',
    passwordChanged      : 'Parolă schimbată cu succes!',
    passwordMismatch     : 'Parolele nu coincid.',
    passwordTooShort     : 'Parola trebuie să aibă cel puțin 6 caractere.',
    accountCreatedOn     : 'Cont creat pe',
    // Shortcuts modal
    shortcutsTitle       : 'Scurtături tastatură',
    shortcutPlay         : 'Play / Pauză',
    shortcutMute         : 'Mute / Unmute volum',
    shortcutsHint        : 'Scurtăturile funcționează în pagina playerului',
    openHelp             : 'Deschide ajutor',
    closeModal           : 'Închide',
    // Admin challenges
    typeListeningTime    : 'Timp ascultare (min)',
    typeBooksCompleted   : 'Cărți finalizate',
    typePdfSessions      : 'Sesiuni PDF',
    typeStreak           : 'Streak zile',
    typeCategoryExplorer : 'Categorii explorate',
    archiveConfirm       : 'Arhivezi această provocare?',
    challengeSaved       : 'Salvat',
    challengeCreated     : 'Provocare creată',
    newChallengeBtn      : 'Provocare nouă',
    noChallengesYet      : 'Nicio provocare. Creează prima!',
    participantsSuffix   : 'participanți',
    completionSuffix     : '% finalizare',
    deactivate           : 'Dezactivează',
    activate             : 'Activează',
    editChallengeBtn     : 'Editează provocarea',
    formTitleLabel       : 'Titlu *',
    formDescLabel        : 'Descriere *',
    formBadgeLabel       : 'Iconiță badge',
    formXpLabel          : 'Recompensă XP',
    formTargetLabel      : 'Țintă (valoare numerică)',
    formStartLabel       : 'Data start (opțional)',
    formEndLabel         : 'Data final (opțional)',
    typeLabel            : 'Tip',
    periodLabel          : 'Perioadă',
    difficultyLabel      : 'Dificultate',
    titleRequired        : 'Titlul este obligatoriu',
    // HomeClient toasts
    errAuthRequired      : 'Autentifică-te pentru a folosi această funcție.',
    removedFromFav       : 'Eliminat din favorite.',
    addedToFav           : 'Adăugat la favorite!',
    errFavoriteUpdate    : 'Eroare la actualizarea favoritelor.',
    addedToLater         : 'Adăugat la lista de ascultare!',
    // PersonalDocumentsSection
    resetProgress        : 'Resetează progresul',
  },
  en: {
    // Header
    searchPlaceholder : 'Search books, authors...',
    notifications     : 'Notifications',
    newInLibrary      : 'New in library',
    noNotifications   : 'No notifications',
    loading           : 'Loading…',
    clearAll          : 'Clear all',
    seeFullLibrary    : 'See full library →',
    // Sidebar
    library           : 'Library',
    mySpace           : 'My Space',
    adminPanel        : 'Admin Panel',
    logout            : 'Log Out',
    // Home
    sortDefault       : 'Default',
    sortTitle         : 'A–Z',
    sortAuthor        : 'Author',
    sortDuration      : 'Duration',
    noBooksFound      : 'No books found',
    tryAnotherSearch  : 'Try a different search or category',
    continueListening : 'Continue Listening',
    resume            : 'Resume',
    // Category / Language filters (Home)
    allCategories     : 'All',
    allLanguages      : 'All',
    langRo            : 'Romanian',
    langEn            : 'English',
    // Player
    play              : 'Play',
    pause             : 'Pause',
    back15            : 'Back 15 seconds',
    forward15         : 'Forward 15 seconds',
    sleepTimer        : 'Sleep',
    prevChapter       : 'Previous Chapter',
    nextChapter       : 'Next Chapter',
    bookmarks         : 'Bookmarks',
    addBookmark       : 'Add',
    noBookmarks       : 'No bookmarks',
    noBookmarksHint   : 'Add one at the current position.',
    chapters          : 'Chapters',
    nowPlaying        : 'Now Playing',
    // Sidebar progress widget
    annualGoal        : 'Annual Goal',
    outOf             : 'of',
    booksCompletedOf  : 'books completed',
    book              : 'book',
    books             : 'books',
    // Admin — page header & stats
    adminSubtitle     : 'Manage your audiobook library',
    statsBooks        : 'Books',
    statsCategories   : 'Categories',
    statsTotalHours   : 'Total hours',
    adminLibraryTab   : 'Library',
    // Admin — shared labels
    addBook           : 'Add Book',
    back              : 'Back',
    bookTitle         : 'Book Title',
    author            : 'Author',
    category          : 'Category',
    description       : 'Description',
    cover             : 'Cover',
    saving            : 'Saving...',
    processing        : 'Processing...',
    areYouSure        : 'Are you sure?',
    confirmDelete     : 'Yes, delete',
    // Admin — library tab
    noBooksInLibrary  : 'No books in the library.',
    addFirstBook      : 'Add first book',
    // Admin — edit form
    editBookTitle     : 'Edit',
    keepCurrentCover  : 'Leave empty to keep the current cover',
    // Admin — add form
    bookDetails       : 'Book Details',
    bookDetailsDesc   : 'Basic information displayed in the library',
    durationAuto      : '⏱ Duration is auto-detected from the audio file.',
    descPlaceholder   : 'A short description of the book...',
    coverDesc         : 'Cover image stored on Cloudinary',
    coverLabel        : 'Cover (.jpg / .png / .webp)',
    uploadNotice      : 'Large audio files may take 1–3 minutes to upload (Cloudinary free tier). The page stays active.',
    audioChapters     : 'Audio Chapters',
    chaptersDesc      : 'Add one or more chapters. The list order is the playback order.',
    chapterWord       : 'Chapter',
    chapterSingular   : 'chapter',
    chapterPlural     : 'chapters',
    addChapter        : 'Add Chapter',
    uploadingCloud    : 'Uploading to Cloudinary…',
    finalizing        : 'Finalizing…',
    publishedSuccess  : 'Published successfully!',
    publish           : 'Publish Audiobook',
    saveChanges       : 'Save Changes',
    cancel            : 'Cancel',
    // Book language labels
    bookLanguage      : 'Book Language',
    romanian          : 'Romanian',
    english           : 'English',
    // Home — favorites filter
    myFavorites       : 'My Favorites',
    // Dashboard — page
    dashSubtitle      : 'Your stats, library progress and personal documents',
    // Dashboard — stat cards
    totalListened     : 'Total listened',
    booksStartedStat  : 'Books started',
    booksCompleted    : 'Completed',
    favoriteCategory  : 'Favorite category',
    // Dashboard — activity chart
    weeklyActivity    : 'Weekly activity',
    booksListened7Days: 'Books listened in the last 7 days',
    // Dashboard — challenges
    challenges        : 'Challenges',
    challengesAdmin   : 'Manage Challenges',
    doneBadge         : '✓ Done',
    ch1Label          : 'First Step',
    ch1Desc           : 'Complete your first audiobook',
    ch2Label          : 'Avid Reader',
    ch2Desc           : 'Complete 5 audiobooks',
    ch3Label          : 'Marathoner',
    ch3Desc           : 'Listen to at least 5 hours total',
    ch4Label          : 'Explorer',
    ch4Desc           : 'Explore 3 different categories',
    ch5Label          : 'Active Week',
    ch5Desc           : 'Be active 5 out of the last 7 days',
    categoryUnit      : 'category',
    categoriesUnit    : 'categories',
    daysUnit          : 'days',
    // Dashboard — listen later
    listenLaterSection: 'Listen Later',
    // Dashboard — continue listening empty state
    noBookStarted     : "You haven't started any book",
    exploreLibraryHint: 'Explore the library to find your first book',
    exploreLibraryBtn : 'Explore the library',
    // Dashboard — documents section
    myDocuments       : 'My Documents',
    howItWorksTitle   : 'How do personal documents work?',
    how1a             : 'Upload',
    how1Bold          : 'course notes',
    how1b             : ', articles or reports in PDF format with selectable text.',
    how2a             : 'Text is extracted and can be',
    how2Bold          : 'listened to with a synthesized voice',
    how2b             : ' — ideal for screenless study.',
    how3a             : '',
    how3Bold          : 'Quick summary',
    how3b             : ' appears in under a second, no downloads needed.',
    how4a             : '',
    how4Bold          : 'The neural model',
    how4b             : ' (~40 MB, downloaded once) produces a more refined summary in 1–2 minutes.',
    howWarning        : 'Scans and handwritten documents are not supported — selectable text must be present in the PDF.',
    uploadNewDoc      : 'Upload new document',
    docTitleLabel     : 'Document title',
    pdfFileLabel      : 'PDF File',
    uploadBtn         : 'Upload',
    noDocUploaded     : 'No documents uploaded',
    addFirstPdfHint   : 'Use the form above to add your first PDF',
    listenAction      : 'Listen',
    stopAction        : 'Stop',
    pauseAction       : 'Pause',
    resumeAction      : 'Resume',
    summarizeAction   : 'Summarize',
    regenerateAction  : 'Regenerate',
    quickSummaryBadge : 'Quick',
    neuralSummaryTitle: 'Neural AI Summary',
    quickSummaryTitle : 'Quick Summary',
    upgradingToNeural : 'Upgrading…',
    // Player — sleep timer
    cancelTimer       : 'Cancel timer',
    // Dashboard — PredictiveInsights
    advancedStats     : 'Advanced Statistics',
    listeningPace     : 'Listening Pace',
    notEnoughData     : 'Not enough data yet — listen more!',
    perDayAvg         : 'per day on average',
    daysInARow        : 'days in a row',
    categoryDistrib   : 'Category Distribution',
    timeByGenre       : 'Time listened by genre',
    completionPred    : 'Completion Prediction',
    basedOnPace       : 'Based on your current listening pace',
    unknownDate       : 'Unknown date',
    // Dashboard — toast messages
    errLoadData       : 'Error loading data.',
    errNoPdf          : 'Please select a PDF file!',
    pdfSaved          : 'PDF processed and saved!',
    errUpload         : 'Upload error.',
    errConnection     : 'Connection error.',
    errLoadContent    : 'Error loading content.',
    removedFromLater  : 'Removed from Listen Later.',
    docDeleted        : 'Document deleted.',
    errDelete         : 'Delete error.',
    errContentUnavail : 'Content unavailable.',
    errAiUnavail      : 'AI feature unavailable.',
    errSummaryGenerate: 'Error generating summary.',
    errWorkerInternal : 'Internal AI worker error.',
    // Dashboard — AI worker status strings
    quickSummaryDone  : 'Quick summary ready. Upgrading with AI…',
    aiInitializing    : 'Initializing…',
    // Dashboard — inline labels
    searchDocs        : 'Search documents…',
    selectedFile      : 'Selected file:',
    deleteDoc         : 'Delete document',
    docTitlePlaceholder: 'e.g. Algorithms Course — S3',
    // Player page — toasts, labels, hints
    sleepTimerFired   : 'Sleep timer activated!',
    bookmarkAdded     : 'Bookmark added!',
    errBookmarkAdd    : 'Error adding bookmark.',
    errGeneric        : 'Error.',
    backToLibrary     : 'Library',
    bookmarkAt        : 'Bookmark at',
    deleteBookmark    : 'Delete bookmark',
    keyboardHint      : 'Space = Play · ← → = 15s · M = Mute',
    bookCompleted     : 'Complete',
    // Dashboard — streak widget
    streakTitle          : 'Listening Streak',
    streakStart          : 'Listen today to start a streak!',
    streakDay1           : '1 consecutive day — keep going!',
    streakNDays          : 'consecutive days',
    streakRecord         : 'Personal record:',
    streakFire           : '🔥 On Fire',
    // Dashboard — XP / level widget
    levelLabel           : 'Level',
    xpAccumulated        : 'XP accumulated',
    nextLevelAbbr        : 'Lvl.',
    // Dashboard — personal docs sub-section
    personalDocsSection  : 'Personal documents',
    // Profile page
    profilePersonalInfo  : 'Personal information',
    profileChangePassword: 'Change password',
    nameLabel            : 'Name',
    saveInfoBtn          : 'Save information',
    currentPasswordLabel : 'Current password',
    newPasswordLabel     : 'New password',
    confirmPasswordLabel : 'Confirm password',
    challengesCompletedSuffix: ' challenges completed',
    errLoadProfile       : 'Error loading profile.',
    profileUpdated       : 'Information updated successfully!',
    passwordChanged      : 'Password changed successfully!',
    passwordMismatch     : 'Passwords do not match.',
    passwordTooShort     : 'Password must be at least 6 characters.',
    accountCreatedOn     : 'Account created on',
    // Shortcuts modal
    shortcutsTitle       : 'Keyboard shortcuts',
    shortcutPlay         : 'Play / Pause',
    shortcutMute         : 'Mute / Unmute volume',
    shortcutsHint        : 'Shortcuts work on the player page',
    openHelp             : 'Open help',
    closeModal           : 'Close',
    // Admin challenges
    typeListeningTime    : 'Listening time (min)',
    typeBooksCompleted   : 'Books completed',
    typePdfSessions      : 'PDF sessions',
    typeStreak           : 'Streak days',
    typeCategoryExplorer : 'Categories explored',
    archiveConfirm       : 'Archive this challenge?',
    challengeSaved       : 'Saved',
    challengeCreated     : 'Challenge created',
    newChallengeBtn      : 'New challenge',
    noChallengesYet      : 'No challenges yet. Create the first one!',
    participantsSuffix   : 'participants',
    completionSuffix     : '% completion',
    deactivate           : 'Deactivate',
    activate             : 'Activate',
    editChallengeBtn     : 'Edit challenge',
    formTitleLabel       : 'Title *',
    formDescLabel        : 'Description *',
    formBadgeLabel       : 'Badge icon',
    formXpLabel          : 'XP Reward',
    formTargetLabel      : 'Target (numeric value)',
    formStartLabel       : 'Start date (optional)',
    formEndLabel         : 'End date (optional)',
    typeLabel            : 'Type',
    periodLabel          : 'Period',
    difficultyLabel      : 'Difficulty',
    titleRequired        : 'Title is required',
    // HomeClient toasts
    errAuthRequired      : 'Sign in to use this feature.',
    removedFromFav       : 'Removed from favorites.',
    addedToFav           : 'Added to favorites!',
    errFavoriteUpdate    : 'Error updating favorites.',
    addedToLater         : 'Added to listen later!',
    // PersonalDocumentsSection
    resetProgress        : 'Reset progress',
  },
} as const;

export type Lang    = keyof typeof dict;
export type DictKey = keyof typeof dict['ro'];

// ── Context ───────────────────────────────────────────────────────────────────

interface LanguageContextValue {
  lang   : Lang;
  setLang: (l: Lang) => void;
  t      : (key: DictKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be inside LanguageProvider');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Default 'ro' on first render (avoids SSR/hydration mismatch).
  // The effect below reads localStorage and switches if the user saved 'en'.
  const [lang, setLangState] = useState<Lang>('ro');

  useEffect(() => {
    const saved = localStorage.getItem('lang');
    if (saved === 'en' || saved === 'ro') setLangState(saved);
  }, []);

  // Keep <html lang="…"> in sync for accessibility / SEO
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('lang', l);
  }, []);

  const t = useCallback(
    (key: DictKey): string => dict[lang][key] as string,
    [lang],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, t }),
    [lang, setLang, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
