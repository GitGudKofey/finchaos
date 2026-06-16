/* ==========================================================================
   FinChaos JavaScript Logic (Vanilla JS Cloud SaaS)
   ========================================================================= */

// Supabase Configuration
const SUPABASE_URL = (window.location.hostname === 'localhost' || window.location.protocol === 'file:')
    ? "https://loerfcxrwzmejszwsipl.supabase.co"
    : `${window.location.origin}/api/supabase`;
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZXJmY3hyd3ptZWpzendzaXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1ODgzODYsImV4cCI6MjA5NzE2NDM4Nn0.ixNlHSlkn7eS1x42lhb5oKoYKAN8Xx8jsl8loa1qh7s"; // Please insert your Supabase Anon Key here

// Default Currency rates relative to RUB (Russian Ruble) if not set in storage
const DEFAULT_RATES = {
    USD: 90,
    EUR: 98
};

const MONTH_NAMES = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const CATEGORY_MAP = {
    software: 'Софт / Инструменты',
    entertainment: 'Развлечения / Медиа',
    work: 'Работа / Проекты',
    utilities: 'Связь и хостинг',
    other: 'Другое'
};

const PERIOD_MAP = {
    monthly: 'Ежемесячно',
    quarterly: 'Раз в 3 месяца',
    'semi-annually': 'Раз в 6 месяцев',
    annually: 'Ежегодно'
};

// Supabase Client Instance
let supabaseClient = null;

// Global App State
let state = {
    authMode: 'demo', // 'demo' vs 'supabase' vs 'ask'
    currentUser: null,
    expenses: [],
    budgets: {}, // { 'YYYY-MM': Number }
    globalCurrency: 'RUB',
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(), // 0-indexed
    rates: { ...DEFAULT_RATES }, // Customizable exchange rates
    filters: {
        search: '',
        category: 'all',
        sortBy: 'date-asc',
        hidePaid: false
    },
    chartMode: 'all', // 'all' vs 'paid'
    activeTab: 'dashboard', // 'dashboard' vs 'subscriptions' vs 'analytics'
    dashboardViewMode: 'cards', // 'cards' vs 'calendar'
    // Temporary target trackers for deletion
    deleteTargetId: null,
    deleteTargetSubId: null
};

// ==========================================================================
// Initialization & Storage
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
    initCategories();
    initAuthModeAndClient();
    await checkUserSession();
    initEventListeners();
    setupStoriesHoldListeners();
    populateCategoryDropdowns();
    initAuthUI();
    await loadExchangeRates();
});

function initAuthModeAndClient() {
    const storedAuthMode = localStorage.getItem('finchaos_auth_mode');
    if (storedAuthMode) {
        state.authMode = storedAuthMode;
    } else {
        state.authMode = 'ask';
    }

    if (typeof window.supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY_HERE") {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } catch (err) {
            console.error('Failed to initialize Supabase client:', err);
            supabaseClient = null;
        }
    }
}

async function checkUserSession() {
    if (!supabaseClient) {
        state.authMode = 'demo';
        state.currentUser = null;
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (data && data.session) {
            state.currentUser = data.session.user;
            state.authMode = 'supabase';
        } else {
            state.currentUser = null;
            if (state.authMode === 'supabase') {
                state.authMode = 'ask';
            }
        }
    } catch (err) {
        console.error('Error checking session:', err);
        state.currentUser = null;
        state.authMode = 'demo';
    }
}

function initAuthUI() {
    const viewAuth = document.getElementById('view-auth');
    const appContainer = document.querySelector('.app-container');
    const logoutBtn = document.getElementById('btn-logout');

    const alertEl = document.getElementById('auth-alert');
    if (alertEl && SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY_HERE") {
        alertEl.textContent = "Supabase не настроен. Пожалуйста, вставьте ваш Anon Key в начало файла app.js. Доступен только демо-режим.";
        alertEl.className = "auth-alert error";
        alertEl.classList.remove('hidden');
    }

    if (state.authMode === 'supabase' && state.currentUser) {
        if (viewAuth) viewAuth.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');
        if (logoutBtn) {
            logoutBtn.style.display = 'flex';
            logoutBtn.title = `Выйти (${state.currentUser.email})`;
        }

        const userNameEl = document.getElementById('user-profile-name');
        const userRoleEl = document.getElementById('user-profile-role');
        const userAvatarEl = document.getElementById('user-profile-avatar');
        if (userNameEl) userNameEl.textContent = state.currentUser.email.split('@')[0];
        if (userRoleEl) userRoleEl.textContent = 'Облачный аккаунт';
        if (userAvatarEl) userAvatarEl.textContent = getInitials(state.currentUser.email.split('@')[0] || 'Cloud');

        loadStateFromSupabase().then(() => {
            updateUI();
            if (!localStorage.getItem('finchaos_onboarding_completed')) {
                setTimeout(() => startOnboardingTour(), 1500);
            }
        });
    } else if (state.authMode === 'demo') {
        if (viewAuth) viewAuth.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');
        if (logoutBtn) {
            logoutBtn.style.display = 'flex';
            logoutBtn.title = "Вернуться к авторизации";
        }

        const userNameEl = document.getElementById('user-profile-name');
        const userRoleEl = document.getElementById('user-profile-role');
        const userAvatarEl = document.getElementById('user-profile-avatar');
        if (userNameEl) userNameEl.textContent = 'Демо-пользователь';
        if (userRoleEl) userRoleEl.textContent = 'Локальное хранилище';
        if (userAvatarEl) userAvatarEl.textContent = 'DM';

        loadStateFromStorage();
        updateUI();
        if (!localStorage.getItem('finchaos_onboarding_completed')) {
            setTimeout(() => startOnboardingTour(), 1500);
        }
    } else {
        if (viewAuth) viewAuth.classList.remove('hidden');
        if (appContainer) appContainer.classList.add('hidden');

        setupAuthFormListeners();
    }
}

function setupAuthFormListeners() {
    const authForm = document.getElementById('auth-form');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const btnContinueDemo = document.getElementById('btn-continue-demo');
    const alertEl = document.getElementById('auth-alert');

    window.authIsSignUpMode = false;

    if (authForm) {
        authForm.removeEventListener('submit', handleAuthSubmit);
        authForm.addEventListener('submit', handleAuthSubmit);
    }

    async function handleAuthSubmit(e) {
        e.preventDefault();

        if (!supabaseClient) {
            if (alertEl) {
                alertEl.textContent = "Supabase не настроен. Используйте демо-режим.";
                alertEl.className = "auth-alert error";
                alertEl.classList.remove('hidden');
            }
            return;
        }

        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const isSignUpMode = !!window.authIsSignUpMode;

        if (authSubmitBtn) {
            authSubmitBtn.disabled = true;
            authSubmitBtn.textContent = isSignUpMode ? "Регистрация..." : "Вход...";
        }
        if (alertEl) alertEl.classList.add('hidden');

        try {
            if (isSignUpMode) {
                const { data, error } = await supabaseClient.auth.signUp({
                    email,
                    password
                });

                if (error) throw error;

                if (data && data.user) {
                    if (alertEl) {
                        alertEl.textContent = "Регистрация успешна! Переносим локальные данные...";
                        alertEl.className = "auth-alert success";
                        alertEl.classList.remove('hidden');
                    }

                    await migrateLocalDataToSupabase(data.user.id);

                    state.currentUser = data.user;
                    state.authMode = 'supabase';
                    localStorage.setItem('finchaos_auth_mode', 'supabase');

                    setTimeout(() => {
                        initAuthUI();
                    }, 1500);
                }
            } else {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;

                if (data && data.user) {
                    if (alertEl) {
                        alertEl.textContent = "Успешный вход!";
                        alertEl.className = "auth-alert success";
                        alertEl.classList.remove('hidden');
                    }

                    state.currentUser = data.user;
                    state.authMode = 'supabase';
                    localStorage.setItem('finchaos_auth_mode', 'supabase');

                    setTimeout(() => {
                        initAuthUI();
                    }, 1000);
                }
            }
        } catch (err) {
            if (alertEl) {
                alertEl.textContent = "Ошибка: " + err.message;
                alertEl.className = "auth-alert error";
                alertEl.classList.remove('hidden');
            }
            if (authSubmitBtn) {
                authSubmitBtn.disabled = false;
                authSubmitBtn.textContent = isSignUpMode ? "Зарегистрироваться" : "Войти в аккаунт";
            }
        }
    }

    if (btnContinueDemo) {
        btnContinueDemo.removeEventListener('click', handleDemoClick);
        btnContinueDemo.addEventListener('click', handleDemoClick);
    }

    function handleDemoClick() {
        state.authMode = 'demo';
        localStorage.setItem('finchaos_auth_mode', 'demo');
        initAuthUI();
        if (!localStorage.getItem('finchaos_onboarding_completed')) {
            setTimeout(() => startOnboardingTour(), 1000);
        }
    }

    const tabSignin = document.getElementById('auth-tab-signin');
    const tabSignup = document.getElementById('auth-tab-signup');
    if (tabSignin) {
        tabSignin.addEventListener('click', () => switchAuthTab('signin'));
    }
    if (tabSignup) {
        tabSignup.addEventListener('click', () => switchAuthTab('signup'));
    }
}

function switchAuthTab(tab) {
    const authTabSignin = document.getElementById('auth-tab-signin');
    const authTabSignup = document.getElementById('auth-tab-signup');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const alertEl = document.getElementById('auth-alert');

    if (tab === 'signin') {
        window.authIsSignUpMode = false;
        authTabSignin.classList.add('active');
        authTabSignup.classList.remove('active');
        authSubmitBtn.textContent = "Войти в аккаунт";
        if (alertEl) alertEl.classList.add('hidden');
    } else {
        window.authIsSignUpMode = true;
        authTabSignup.classList.add('active');
        authTabSignin.classList.remove('active');
        authSubmitBtn.textContent = "Зарегистрироваться";
        if (alertEl) alertEl.classList.add('hidden');
    }
}
window.switchAuthTab = switchAuthTab;

async function loadStateFromSupabase() {
    if (!supabaseClient || !state.currentUser) return;

    try {
        const { data: dbExpenses, error: expError } = await supabaseClient
            .from('expenses')
            .select('*');

        if (expError) throw expError;

        state.expenses = (dbExpenses || []).map(exp => ({
            id: exp.id,
            subscriptionId: exp.subscription_id,
            type: exp.type,
            period: exp.period,
            name: exp.name,
            amount: Number(exp.amount),
            currency: exp.currency,
            category: exp.category,
            date: exp.date,
            link: exp.link,
            comment: exp.comment,
            active: exp.active,
            paid: exp.paid,
            deleted: exp.deleted
        }));

        const { data: dbBudgets, error: budError } = await supabaseClient
            .from('budgets')
            .select('month_key, limit_val');

        if (budError) throw budError;

        state.budgets = {};
        (dbBudgets || []).forEach(b => {
            state.budgets[b.month_key] = Number(b.limit_val);
        });

        const { data: dbSettings, error: setError } = await supabaseClient
            .from('user_settings')
            .select('global_currency, rate_usd, rate_eur')
            .maybeSingle();

        if (setError) {
            console.error('Error fetching settings:', setError);
        } else if (dbSettings) {
            state.globalCurrency = dbSettings.global_currency;
            state.rates = {
                USD: Number(dbSettings.rate_usd),
                EUR: Number(dbSettings.rate_eur)
            };
            document.getElementById('global-currency-select').value = state.globalCurrency;
        } else {
            await saveSettingsToSupabase();
        }

    } catch (err) {
        console.error('Error loading data from Supabase:', err);
        alert('Ошибка загрузки данных из облака: ' + err.message);
    }
}

async function saveSettingsToSupabase() {
    if (!supabaseClient || !state.currentUser) return;
    try {
        await supabaseClient.from('user_settings').upsert({
            user_id: state.currentUser.id,
            global_currency: state.globalCurrency,
            rate_usd: state.rates.USD,
            rate_eur: state.rates.EUR
        }, { onConflict: 'user_id' });
    } catch (err) {
        console.error('Error saving settings to Supabase:', err);
    }
}

async function migrateLocalDataToSupabase(userId) {
    if (!supabaseClient) return;

    try {
        const { data: existingExpenses } = await supabaseClient
            .from('expenses')
            .select('id')
            .limit(1);

        if (existingExpenses && existingExpenses.length > 0) {
            return;
        }

        const storedExpenses = localStorage.getItem('finchaos_expenses');
        const storedBudgets = localStorage.getItem('finchaos_budgets');
        const storedCurrency = localStorage.getItem('finchaos_currency');
        const storedRates = localStorage.getItem('finchaos_rates');

        if (storedExpenses) {
            const localExpenses = JSON.parse(storedExpenses);
            if (localExpenses && localExpenses.length > 0) {
                // Generate fresh unique IDs to avoid primary key conflicts
                const remappedExpenses = remapIds(localExpenses);
                
                // Save remapped expenses back to state and localStorage so that local version matches Supabase
                state.expenses = remappedExpenses;
                localStorage.setItem('finchaos_expenses', JSON.stringify(remappedExpenses));

                const dbRows = remappedExpenses.map(exp => ({
                    id: exp.id,
                    user_id: userId,
                    subscription_id: exp.subscriptionId,
                    type: exp.type || 'subscription',
                    period: exp.period || 'monthly',
                    name: exp.name,
                    amount: exp.amount,
                    currency: exp.currency,
                    category: exp.category,
                    date: exp.date,
                    link: exp.link,
                    comment: exp.comment,
                    active: exp.active !== undefined ? exp.active : true,
                    paid: exp.paid !== undefined ? exp.paid : false,
                    deleted: exp.deleted !== undefined ? exp.deleted : false
                }));

                const chunkSize = 50;
                for (let i = 0; i < dbRows.length; i += chunkSize) {
                    const chunk = dbRows.slice(i, i + chunkSize);
                    await supabaseClient.from('expenses').insert(chunk);
                }
            }
        }

        if (storedBudgets) {
            const localBudgets = JSON.parse(storedBudgets);
            const dbRows = Object.keys(localBudgets).map(key => ({
                user_id: userId,
                month_key: key,
                limit_val: localBudgets[key]
            }));
            if (dbRows.length > 0) {
                await supabaseClient.from('budgets').upsert(dbRows);
            }
        }

        let currency = 'RUB';
        let rates = { ...DEFAULT_RATES };
        if (storedCurrency) currency = storedCurrency;
        if (storedRates) {
            try {
                rates = JSON.parse(storedRates);
            } catch (e) { }
        }

        await supabaseClient.from('user_settings').upsert({
            user_id: userId,
            global_currency: currency,
            rate_usd: rates.USD || 90,
            rate_eur: rates.EUR || 98
        }, { onConflict: 'user_id' });

        // Clear local storage after successful migration so database is single source of truth
        localStorage.removeItem('finchaos_expenses');
        localStorage.removeItem('finchaos_budgets');
        localStorage.removeItem('finchaos_currency');
        localStorage.removeItem('finchaos_rates');

    } catch (err) {
        console.error('Failed to migrate data to Supabase:', err);
    }
}

function loadStateFromStorage() {
    const storedExpenses = localStorage.getItem('finchaos_expenses');
    const storedBudgets = localStorage.getItem('finchaos_budgets');
    const storedCurrency = localStorage.getItem('finchaos_currency');
    const storedRates = localStorage.getItem('finchaos_rates');
    const storedChartMode = localStorage.getItem('finchaos_chart_mode');
    const storedViewMode = localStorage.getItem('finchaos_view_mode');

    if (storedCurrency) {
        state.globalCurrency = storedCurrency;
        document.getElementById('global-currency-select').value = storedCurrency;
    }

    if (storedChartMode) {
        state.chartMode = storedChartMode;
    }

    if (storedViewMode) {
        state.dashboardViewMode = storedViewMode;
    }

    if (storedBudgets) {
        state.budgets = JSON.parse(storedBudgets);
    }

    if (storedRates) {
        state.rates = JSON.parse(storedRates);
    } else {
        state.rates = { ...DEFAULT_RATES };
    }

    if (storedExpenses) {
        state.expenses = JSON.parse(storedExpenses);

        // MIGRATION: Ensure all older entries have correct fields
        let migrated = false;
        state.expenses.forEach(exp => {
            if (exp.type === undefined) {
                exp.type = 'subscription';
                migrated = true;
            }
            if (exp.type === 'subscription' && exp.period === undefined) {
                exp.period = 'monthly';
                migrated = true;
            }
            if (exp.type === 'subscription' && !exp.subscriptionId) {
                // Generate a name-based or unique subscription ID
                const nameKey = exp.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                exp.subscriptionId = 'sub-' + (nameKey || 'migrated') + '-' + Math.random().toString(36).substr(2, 4);
                migrated = true;
            }
            if (exp.active === undefined) {
                exp.active = true;
                migrated = true;
            }
            if (exp.paid === undefined) {
                exp.paid = exp.type === 'one-time' ? true : false;
                migrated = true;
            }
        });

        if (migrated) {
            saveStateToStorage();
        }
    } else {
        // Generate mock data on first load
        state.expenses = generateDemoData();
        saveStateToStorage();
    }
}

function saveStateToStorage() {
    if (state.authMode === 'demo') {
        localStorage.setItem('finchaos_expenses', JSON.stringify(state.expenses));
        localStorage.setItem('finchaos_budgets', JSON.stringify(state.budgets));
        localStorage.setItem('finchaos_currency', state.globalCurrency);
        localStorage.setItem('finchaos_rates', JSON.stringify(state.rates));
    }
    localStorage.setItem('finchaos_chart_mode', state.chartMode);
    localStorage.setItem('finchaos_view_mode', state.dashboardViewMode);
}

function generateDemoData() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // Create zero-padded month strings
    const monthStr = String(month + 1).padStart(2, '0');

    // Find previous month
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 0) {
        prevMonth = 11;
        prevYear--;
    }
    const prevMonthStr = String(prevMonth + 1).padStart(2, '0');

    // Initialize default budget for the current month
    const currentMonthKey = `${year}-${monthStr}`;
    state.budgets[currentMonthKey] = 25000; // Default budget limit of 25k RUB

    return [
        {
            id: 'demo-1',
            subscriptionId: 'sub-adobe',
            type: 'subscription',
            period: 'monthly',
            name: 'Adobe Creative Cloud',
            amount: 29.99,
            currency: 'USD',
            category: 'software',
            date: `${year}-${monthStr}-15`,
            link: 'https://www.adobe.com',
            comment: 'Подписка на пакет Creative Cloud (Photoshop, Illustrator). Оплачиваю через зарубежную карту друга.',
            active: true,
            paid: false
        },
        {
            id: 'demo-2',
            subscriptionId: 'sub-yandex',
            type: 'subscription',
            period: 'monthly',
            name: 'Яндекс Плюс',
            amount: 399,
            currency: 'RUB',
            category: 'entertainment',
            date: `${year}-${monthStr}-05`,
            link: 'https://plus.yandex.ru',
            comment: 'Семейный доступ. Музыка, Кинопоиск, баллы Плюса.',
            active: true,
            paid: true
        },
        {
            id: 'demo-3',
            subscriptionId: 'sub-selectel',
            type: 'subscription',
            period: 'monthly',
            name: 'Selectel VPS',
            amount: 1450,
            currency: 'RUB',
            category: 'utilities',
            date: `${year}-${monthStr}-10`,
            link: 'https://selectel.ru',
            comment: 'Виртуальный сервер для личных ботов и пет-проектов. Пополняю раз в месяц.',
            active: true,
            paid: true
        },
        {
            id: 'demo-4',
            subscriptionId: 'sub-chatgpt',
            type: 'subscription',
            period: 'monthly',
            name: 'ChatGPT Plus',
            amount: 20,
            currency: 'USD',
            category: 'software',
            date: `${year}-${monthStr}-22`,
            link: 'https://chatgpt.com',
            comment: 'Использую для обучения и генерации кода. Очень помогает!',
            active: true,
            paid: false
        },
        {
            id: 'demo-5',
            subscriptionId: 'sub-spotify',
            type: 'subscription',
            period: 'monthly',
            name: 'Spotify Premium',
            amount: 5.99,
            currency: 'EUR',
            category: 'entertainment',
            date: `${year}-${monthStr}-01`,
            link: 'https://spotify.com',
            comment: 'Турецкий аккаунт Spotify. Оплачен подарочными картами на полгода вперед.',
            active: true,
            paid: true
        },
        {
            id: 'demo-6',
            subscriptionId: null,
            type: 'one-time',
            period: null,
            name: 'Курс по дизайну',
            amount: 4900,
            currency: 'RUB',
            category: 'work',
            date: `${year}-${monthStr}-28`,
            link: 'https://dribbble.com',
            comment: 'Покупка полезного курса по дизайну интерфейсов на Dribbble.',
            active: true,
            paid: true
        },
        // Demo Annual Subscriptions to test recurrence logic
        {
            id: 'demo-7',
            subscriptionId: 'sub-jetbrains',
            type: 'subscription',
            period: 'annually',
            name: 'Лицензия JetBrains',
            amount: 89,
            currency: 'USD',
            category: 'software',
            date: `${year - 1}-${monthStr}-15`, // Exactly 1 year ago, so it is due this month
            link: 'https://www.jetbrains.com',
            comment: 'Годовая персональная лицензия на All Products Pack. Пора продлевать.',
            active: true,
            paid: false
        },
        {
            id: 'demo-8',
            subscriptionId: 'sub-domain',
            type: 'subscription',
            period: 'annually',
            name: 'Домен finchaos.ru',
            amount: 900,
            currency: 'RUB',
            category: 'utilities',
            date: `${year}-${prevMonthStr}-18`, // Paid 1 month ago. Should NOT show up this month!
            link: 'https://www.reg.ru',
            comment: 'Оплата домена для финансового трекера. Продлен на год.',
            active: true,
            paid: true
        }
    ];
}

// ==========================================================================
// Helpers & Currency Conversion
// ==========================================================================

function convertAmount(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;

    // Use dynamic exchange rates from state
    const rates = {
        RUB: 1,
        USD: state.rates.USD || DEFAULT_RATES.USD,
        EUR: state.rates.EUR || DEFAULT_RATES.EUR
    };

    const inRub = amount * rates[fromCurrency];
    return inRub / rates[toCurrency];
}

function formatCurrency(amount, currency) {
    let symbol = '₽';
    let locale = 'ru-RU';
    if (currency === 'USD') {
        symbol = '$';
        locale = 'en-US';
    } else if (currency === 'EUR') {
        symbol = '€';
        locale = 'de-DE';
    }

    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatComment(text) {
    if (!text) return '<span class="text-muted">Нет описания</span>';

    // Simple HTML escaping to prevent XSS
    const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    // Match URLs and wrap them in HTML anchor tags
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return escaped.replace(urlRegex, (url) => {
        let cleanUrl = url;
        let suffix = '';
        // Clean punctuation marks if trailing the link
        if (/[.,;:!?]$/.test(url)) {
            cleanUrl = url.slice(0, -1);
            suffix = url.slice(-1);
        }
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${suffix}`;
    });
}

function getCurrentMonthKey() {
    const monthStr = String(state.currentMonth + 1).padStart(2, '0');
    return `${state.currentYear}-${monthStr}`;
}

// Get initials for avatar/icon (max 2 characters)
function getInitials(name) {
    return name
        .split(' ')
        .slice(0, 2)
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase();
}

// Remap all expense and subscription IDs to avoid global primary key conflicts
function remapIds(expenses) {
    if (!Array.isArray(expenses)) return [];
    const subIdMap = new Map();
    return expenses.map((exp, idx) => {
        const newId = 'exp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '-' + idx;
        let oldSubId = exp.subscriptionId || exp.subscription_id || null;
        let newSubId = null;
        if (oldSubId) {
            if (!subIdMap.has(oldSubId)) {
                subIdMap.set(oldSubId, 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '-' + idx);
            }
            newSubId = subIdMap.get(oldSubId);
        }
        return {
            ...exp,
            id: newId,
            subscriptionId: newSubId
        };
    });
}

async function fetchCBRRates() {
    try {
        const response = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
        if (!response.ok) throw new Error('CBR server response error');
        const data = await response.json();
        if (data && data.Valute && data.Valute.USD && data.Valute.EUR) {
            return {
                USD: Number(data.Valute.USD.Value),
                EUR: Number(data.Valute.EUR.Value)
            };
        }
    } catch (err) {
        console.error('Failed to fetch rates from CBR API:', err);
    }
    return null;
}

async function loadExchangeRates() {
    const autoUpdate = localStorage.getItem('finchaos_rates_auto_update') !== 'false';
    if (autoUpdate) {
        const cbrRates = await fetchCBRRates();
        if (cbrRates) {
            state.rates.USD = cbrRates.USD;
            state.rates.EUR = cbrRates.EUR;
            saveStateToStorage();
            if (state.authMode === 'supabase' && state.currentUser) {
                await saveSettingsToSupabase();
            }
            updateUI();
        }
    }
}

// ==========================================================================
// Subscription Propagation Logic
// ==========================================================================

function replicateSubscriptionsForCurrentMonth() {
    // Group all subscriptions by subscriptionId
    const uniqueSubIds = [...new Set(
        state.expenses
            .filter(exp => exp.type === 'subscription' && exp.subscriptionId && !exp.deleted)
            .map(exp => exp.subscriptionId)
    )];

    const currentMonthStr = String(state.currentMonth + 1).padStart(2, '0');
    const lastDayOfCurrentMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
    let replicatedAny = false;

    uniqueSubIds.forEach(subId => {
        // Find all non-deleted instances of this subscription
        const instances = state.expenses.filter(exp => exp.subscriptionId === subId && !exp.deleted);
        if (instances.length === 0) return;

        // Find the base instance (oldest date in history) to serve as anchor
        const baseInstance = instances.reduce((oldest, current) => {
            return new Date(current.date) < new Date(oldest.date) ? current : oldest;
        }, instances[0]);

        // Find the most recent instance overall to check active status and copy recent details
        const mostRecentInstance = instances.reduce((latest, current) => {
            return new Date(current.date) > new Date(latest.date) ? current : latest;
        }, instances[0]);

        // Do not replicate if the subscription is paused
        if (!mostRecentInstance.active) {
            return;
        }

        // Check if there is already an instance in the current selected month (including deleted ones!)
        // This is crucial: if they deleted it in this month, the deleted record stays, so we do NOT replicate it again.
        const allInstances = state.expenses.filter(exp => exp.subscriptionId === subId);
        const existsInCurrentMonth = allInstances.some(exp => {
            const expDate = new Date(exp.date);
            return expDate.getFullYear() === state.currentYear && expDate.getMonth() === state.currentMonth;
        });

        if (existsInCurrentMonth) {
            return; // Already exists (or was explicitly deleted in this month)
        }

        // Calculate billing month eligibility
        const baseDate = new Date(baseInstance.date);
        const baseYear = baseDate.getFullYear();
        const baseMonth = baseDate.getMonth();
        const baseDay = baseDate.getDate();

        const targetYear = state.currentYear;
        const targetMonth = state.currentMonth;

        // Calculate the difference in months between base date and target date
        const totalMonthDiff = (targetYear - baseYear) * 12 + (targetMonth - baseMonth);

        // Skip if target month is before base month
        if (totalMonthDiff <= 0) {
            return;
        }

        let isBillingMonth = false;
        const period = mostRecentInstance.period || 'monthly';

        if (period === 'monthly') {
            isBillingMonth = (totalMonthDiff % 1 === 0);
        } else if (period === 'quarterly') {
            isBillingMonth = (totalMonthDiff % 3 === 0);
        } else if (period === 'semi-annually') {
            isBillingMonth = (totalMonthDiff % 6 === 0);
        } else if (period === 'annually') {
            isBillingMonth = (totalMonthDiff % 12 === 0);
        }

        if (isBillingMonth) {
            // Replicate details from the most recent instance (preserves name/price updates)
            const adjustedDay = Math.min(baseDay, lastDayOfCurrentMonth);
            const adjustedDayStr = String(adjustedDay).padStart(2, '0');
            const newDateStr = `${targetYear}-${currentMonthStr}-${adjustedDayStr}`;

            const newInstance = {
                id: 'exp-' + Date.now() + Math.random().toString(36).substr(2, 5),
                subscriptionId: subId,
                type: 'subscription',
                period: period,
                name: mostRecentInstance.name,
                amount: mostRecentInstance.amount,
                currency: mostRecentInstance.currency,
                category: mostRecentInstance.category,
                date: newDateStr,
                link: mostRecentInstance.link,
                comment: mostRecentInstance.comment,
                active: true,
                paid: false
            };

            state.expenses.push(newInstance);
            replicatedAny = true;

            if (state.authMode === 'supabase' && state.currentUser) {
                supabaseClient.from('expenses').insert({
                    id: newInstance.id,
                    user_id: state.currentUser.id,
                    subscription_id: newInstance.subscriptionId,
                    type: newInstance.type,
                    period: newInstance.period,
                    name: newInstance.name,
                    amount: newInstance.amount,
                    currency: newInstance.currency,
                    category: newInstance.category,
                    date: newInstance.date,
                    link: newInstance.link,
                    comment: newInstance.comment,
                    active: newInstance.active,
                    paid: newInstance.paid,
                    deleted: false
                }).then(({ error }) => { if (error) console.error('Error auto-replicating subscription to Supabase:', error); });
            }
        }
    });

    if (replicatedAny && state.authMode === 'demo') {
        saveStateToStorage();
    }
}

// ==========================================================================
// UI Updates & Rendering
// ==========================================================================

function getCurrentMonthExpenses() {
    return state.expenses.filter(exp => {
        if (exp.deleted) return false;
        if (!exp.date) return false;
        const expDate = new Date(exp.date);
        return expDate.getFullYear() === state.currentYear && expDate.getMonth() === state.currentMonth;
    });
}

function renderDashboardActiveView() {
    const currentMonthExpenses = getCurrentMonthExpenses();
    if (state.dashboardViewMode === 'cards') {
        renderExpenses(currentMonthExpenses);
    } else {
        renderCalendarView(currentMonthExpenses);
    }
}

function updateDashboardViewModeUI() {
    const btnCards = document.getElementById('view-toggle-cards');
    const btnCal = document.getElementById('view-toggle-calendar');
    const viewGrid = document.getElementById('expenses-grid');
    const viewCal = document.getElementById('expenses-calendar-view');

    if (!btnCards || !btnCal || !viewGrid || !viewCal) return;

    if (state.dashboardViewMode === 'cards') {
        btnCards.classList.add('active');
        btnCal.classList.remove('active');
        viewGrid.classList.remove('hidden');
        viewCal.classList.add('hidden');
    } else {
        btnCards.classList.remove('active');
        btnCal.classList.add('active');
        viewGrid.classList.add('hidden');
        viewCal.classList.remove('hidden');
    }
}

function toggleDashboardViewMode(mode) {
    state.dashboardViewMode = mode;
    saveStateToStorage();
    updateDashboardViewModeUI();
    renderDashboardActiveView();
}

function updateUI() {
    replicateSubscriptionsForCurrentMonth();
    updateMonthDisplay();

    const currentMonthExpenses = getCurrentMonthExpenses();

    updateChartToggleButtons();
    updateDashboardViewModeUI();

    if (state.dashboardViewMode === 'cards') {
        renderExpenses(currentMonthExpenses);
    } else {
        renderCalendarView(currentMonthExpenses);
    }

    updateStats(currentMonthExpenses);
    renderCategoryChart(currentMonthExpenses);
    renderUpcomingWidget(currentMonthExpenses);

    if (state.activeTab === 'subscriptions') {
        renderSubscriptionsTable();
    } else if (state.activeTab === 'analytics') {
        renderAnalyticsTab();
    }
}

function updateChartToggleButtons() {
    const btnAll = document.getElementById('chart-toggle-all');
    const btnPaid = document.getElementById('chart-toggle-paid');
    if (!btnAll || !btnPaid) return;

    if (state.chartMode === 'all') {
        btnAll.classList.add('active');
        btnPaid.classList.remove('active');
    } else {
        btnAll.classList.remove('active');
        btnPaid.classList.add('active');
    }
}

function updateMonthDisplay() {
    const displayEl = document.getElementById('current-month-display');
    displayEl.textContent = `${MONTH_NAMES[state.currentMonth]} ${state.currentYear}`;
}

function updateStats(currentMonthExpenses) {
    const monthKey = getCurrentMonthKey();

    let totalPaid = 0;      // Actual spent (paid === true)
    let totalPending = 0;   // Planned unpaid (active === true && paid === false)

    currentMonthExpenses.forEach(exp => {
        if (exp.active) {
            const converted = convertAmount(exp.amount, exp.currency, state.globalCurrency);

            if (exp.paid) {
                totalPaid += converted;
            } else {
                totalPending += converted;
            }
        }
    });

    const totalPlanned = totalPaid + totalPending;

    // Set Total Planned Card values
    document.getElementById('total-planned-value').textContent = formatCurrency(totalPlanned, state.globalCurrency);
    document.getElementById('total-paid-sub').textContent = formatCurrency(totalPaid, state.globalCurrency);
    document.getElementById('total-pending-sub').textContent = formatCurrency(totalPending, state.globalCurrency);

    // Draw Month-over-Month trend
    updateMomTrend(totalPlanned);

    // Set Budget Card
    const budgetLimit = state.budgets[monthKey] || 0;
    document.getElementById('budget-limit-value').textContent = formatCurrency(budgetLimit, state.globalCurrency);

    // Update Budget progress bar
    updateBudgetProgress(totalPaid, totalPending, budgetLimit);
}

function updateBudgetProgress(totalPaid, totalPending, budgetLimit) {
    const fillSpentEl = document.getElementById('budget-progress-fill-spent');
    const fillPendingEl = document.getElementById('budget-progress-fill-pending');
    const percentEl = document.getElementById('budget-progress-percent');
    const remainingEl = document.getElementById('budget-remaining-value');

    if (budgetLimit <= 0) {
        fillSpentEl.style.width = '0%';
        fillPendingEl.style.width = '0%';
        percentEl.textContent = 'Бюджет не установлен';
        remainingEl.textContent = 'Установите бюджет';
        remainingEl.style.color = '';
        return;
    }

    const spentPercent = Math.round((totalPaid / budgetLimit) * 100);
    const pendingPercent = Math.round((totalPending / budgetLimit) * 100);
    const totalPercent = spentPercent + pendingPercent;

    fillSpentEl.style.width = `${Math.min(spentPercent, 100)}%`;
    fillPendingEl.style.width = `${Math.min(pendingPercent, 100 - Math.min(spentPercent, 100))}%`;

    percentEl.textContent = `${totalPercent}% запланировано (${spentPercent}% оплачено)`;

    const totalPlanned = totalPaid + totalPending;
    const remaining = budgetLimit - totalPlanned;
    if (remaining >= 0) {
        remainingEl.textContent = `Осталось: ${formatCurrency(remaining, state.globalCurrency)}`;
        remainingEl.style.color = '';
    } else {
        remainingEl.textContent = `Перерасход: ${formatCurrency(Math.abs(remaining), state.globalCurrency)}`;
        remainingEl.style.color = 'var(--danger-text)';
    }

    // Apply status coloring
    fillSpentEl.className = 'budget-progress-fill-spent';
    fillPendingEl.className = 'budget-progress-fill-pending';

    if (totalPercent <= 70) {
        fillSpentEl.classList.add('budget-fill-spent-safe');
        fillPendingEl.classList.add('budget-fill-pending-safe');
    } else if (totalPercent <= 92) {
        fillSpentEl.classList.add('budget-fill-spent-warning');
        fillPendingEl.classList.add('budget-fill-pending-warning');
    } else {
        fillSpentEl.classList.add('budget-fill-spent-danger');
        fillPendingEl.classList.add('budget-fill-pending-danger');
    }
}

function updateMomTrend(currentTotalPlanned) {
    const badgeEl = document.getElementById('mom-trend-badge');
    badgeEl.className = 'trend-badge';
    badgeEl.innerHTML = '';

    // Find previous month
    let prevMonth = state.currentMonth - 1;
    let prevYear = state.currentYear;
    if (prevMonth < 0) {
        prevMonth = 11;
        prevYear--;
    }

    const prevMonthExpenses = state.expenses.filter(exp => {
        if (exp.deleted) return false;
        if (!exp.date) return false;
        const expDate = new Date(exp.date);
        return expDate.getFullYear() === prevYear && expDate.getMonth() === prevMonth;
    });

    let prevTotalPlanned = 0;
    prevMonthExpenses.forEach(exp => {
        if (exp.active) {
            prevTotalPlanned += convertAmount(exp.amount, exp.currency, state.globalCurrency);
        }
    });

    if (prevTotalPlanned <= 0) {
        badgeEl.style.display = 'none';
        return;
    }

    badgeEl.style.display = 'flex';

    const diff = currentTotalPlanned - prevTotalPlanned;
    const percent = Math.abs(Math.round((diff / prevTotalPlanned) * 100));

    if (diff > 0) {
        badgeEl.classList.add('trend-up');
        badgeEl.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
            <span>+${percent}%</span>
        `;
    } else if (diff < 0) {
        badgeEl.classList.add('trend-down');
        badgeEl.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
            <span>-${percent}%</span>
        `;
    } else {
        badgeEl.classList.add('trend-equal');
        badgeEl.innerHTML = `
            <span>= 0%</span>
        `;
    }
}

function renderCategoryChart(currentMonthExpenses) {
    const donutEl = document.getElementById('category-donut-chart');
    const legendEl = document.getElementById('category-chart-legend');
    const labelEl = document.getElementById('donut-chart-center-label');

    // Clear old segments and legend
    const segments = donutEl.querySelectorAll('.donut-chart-segment');
    segments.forEach(s => s.remove());
    legendEl.innerHTML = '';

    const categoryTotals = {};
    let totalSpentInChart = 0;

    // Calculate category shares based on selected chart mode
    currentMonthExpenses.forEach(exp => {
        const includeExp = (state.chartMode === 'all') ? exp.active : (exp.active && exp.paid);
        if (includeExp) {
            const converted = convertAmount(exp.amount, exp.currency, state.globalCurrency);
            categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + converted;
            totalSpentInChart += converted;
        }
    });

    if (totalSpentInChart === 0) {
        labelEl.textContent = '0%';
        const emptyMsg = state.chartMode === 'all' ? 'Нет расходов в этом месяце' : 'Нет оплат в этом месяце';
        legendEl.innerHTML = `<div style="font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 18px; width: 100%;">${emptyMsg}</div>`;
        return;
    }

    const categoryColors = {};
    Object.keys(state.categories).forEach(id => {
        categoryColors[id] = getCategoryColorHex(id);
    });

    const data = Object.keys(categoryTotals).map(cat => ({
        category: cat,
        amount: categoryTotals[cat],
        percent: Math.round((categoryTotals[cat] / totalSpentInChart) * 100)
    })).sort((a, b) => b.amount - a.amount);

    let cumulativePercent = 0;

    data.forEach(item => {
        const strokeDashArray = `${item.percent} ${100 - item.percent}`;
        const strokeDashOffset = 100 - cumulativePercent;
        cumulativePercent += item.percent;

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'donut-chart-segment');
        circle.setAttribute('cx', '21');
        circle.setAttribute('cy', '21');
        circle.setAttribute('r', '15.915');
        circle.setAttribute('fill', 'transparent');
        circle.setAttribute('stroke', categoryColors[item.category] || '#ccc');
        circle.setAttribute('stroke-width', '4.5');
        circle.setAttribute('stroke-dasharray', strokeDashArray);
        circle.setAttribute('stroke-dashoffset', strokeDashOffset.toString());

        // Interactive tooltips in the center
        circle.addEventListener('mouseenter', () => {
            labelEl.textContent = `${item.percent}%`;
            labelEl.style.color = categoryColors[item.category];
        });
        circle.addEventListener('mouseleave', () => {
            labelEl.textContent = '100%';
            labelEl.style.color = 'var(--text-primary)';
        });

        donutEl.appendChild(circle);

        // Build Legend Item
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `
            <div class="legend-color-label" title="${CATEGORY_MAP[item.category]}">
                <span class="legend-color-dot" style="background-color: ${categoryColors[item.category]}"></span>
                <span>${CATEGORY_MAP[item.category]}</span>
            </div>
            <span class="legend-value">${formatCurrency(item.amount, state.globalCurrency)} (${item.percent}%)</span>
        `;
        legendEl.appendChild(legendItem);
    });

    labelEl.textContent = '100%';
    labelEl.style.color = 'var(--text-primary)';
}

function renderUpcomingWidget(currentMonthExpenses) {
    const listEl = document.getElementById('upcoming-payments-list');
    listEl.innerHTML = '';

    // Select unpaid active subscriptions
    const unpaidSubs = currentMonthExpenses.filter(exp => {
        return exp.type === 'subscription' && exp.active && !exp.paid;
    });

    if (unpaidSubs.length === 0) {
        listEl.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 12px 0; width: 100%;">Все списания оплачены! 🎉</div>';
        return;
    }

    // Sort by payment date ascending
    unpaidSubs.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Slice top 3
    const top3 = unpaidSubs.slice(0, 3);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    top3.forEach(exp => {
        const expDate = new Date(exp.date);
        expDate.setHours(0, 0, 0, 0);
        const timeDiff = expDate.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        let badgeClass = 'badge-days-far';
        let badgeText = '';

        if (daysDiff === 0) {
            badgeClass = 'badge-days-soon';
            badgeText = 'Сегодня';
        } else if (daysDiff === 1) {
            badgeClass = 'badge-days-soon';
            badgeText = 'Завтра';
        } else if (daysDiff > 1 && daysDiff <= 5) {
            badgeClass = 'badge-days-later';
            badgeText = `через ${daysDiff} дн.`;
        } else if (daysDiff < 0) {
            badgeClass = 'badge-days-soon';
            badgeText = `проср. ${Math.abs(daysDiff)} дн.`;
        } else {
            badgeClass = 'badge-days-far';
            badgeText = `через ${daysDiff} дн.`;
        }

        const priceStr = formatCurrency(exp.amount, exp.currency);

        const item = document.createElement('div');
        item.className = 'upcoming-item';
        item.innerHTML = `
            <div class="upcoming-item-info">
                <span class="upcoming-item-name" title="${exp.name}">${exp.name}</span>
                <span class="upcoming-item-price">${priceStr}</span>
            </div>
            <span class="upcoming-days-badge ${badgeClass}">${badgeText}</span>
        `;
        listEl.appendChild(item);
    });
}

function renderExpenses(currentMonthExpenses) {
    const gridEl = document.getElementById('expenses-grid');
    const emptyStateEl = document.getElementById('empty-state-view');
    gridEl.innerHTML = '';

    let filtered = [...currentMonthExpenses];

    // Apply category filter
    if (state.filters.category !== 'all') {
        filtered = filtered.filter(exp => exp.category === state.filters.category);
    }

    // Apply search query filter
    if (state.filters.search.trim() !== '') {
        const query = state.filters.search.toLowerCase();
        filtered = filtered.filter(exp =>
            exp.name.toLowerCase().includes(query) ||
            (exp.comment && exp.comment.toLowerCase().includes(query))
        );
    }

    // Hide paid subscriptions/expenses if filter is active
    if (state.filters.hidePaid) {
        filtered = filtered.filter(exp => !exp.paid);
    }

    // Sort filtered expenses
    filtered.sort((a, b) => {
        if (state.filters.sortBy === 'date-asc') {
            return new Date(a.date) - new Date(b.date);
        }
        if (state.filters.sortBy === 'date-desc') {
            return new Date(b.date) - new Date(a.date);
        }
        if (state.filters.sortBy === 'price-desc') {
            const priceA = convertAmount(a.amount, a.currency, state.globalCurrency);
            const priceB = convertAmount(b.amount, b.currency, state.globalCurrency);
            return priceB - priceA;
        }
        if (state.filters.sortBy === 'price-asc') {
            const priceA = convertAmount(a.amount, a.currency, state.globalCurrency);
            const priceB = convertAmount(b.amount, b.currency, state.globalCurrency);
            return priceA - priceB;
        }
        if (state.filters.sortBy === 'name-asc') {
            return a.name.localeCompare(b.name, 'ru');
        }
        return 0;
    });

    if (filtered.length === 0) {
        gridEl.style.display = 'none';
        emptyStateEl.classList.remove('hidden');
        return;
    }

    gridEl.style.display = '';
    emptyStateEl.classList.add('hidden');

    filtered.forEach(exp => {
        const isSubscription = exp.type === 'subscription';
        const isSuspended = isSubscription && !exp.active;

        const card = document.createElement('div');
        card.className = `expense-card ${isSuspended ? 'suspended' : ''}`;
        card.dataset.id = exp.id;

        const initials = getInitials(exp.name);
        const displayPrice = formatCurrency(exp.amount, exp.currency);

        // Converted subtitle price if item currency doesn't match dashboard display currency
        let convertedPriceHtml = '';
        if (exp.currency !== state.globalCurrency) {
            const converted = convertAmount(exp.amount, exp.currency, state.globalCurrency);
            convertedPriceHtml = `<div class="expense-price-converted">≈ ${formatCurrency(converted, state.globalCurrency)}</div>`;
        }

        // Format billing date
        const expDate = new Date(exp.date);
        const dayFormatted = String(expDate.getDate()).padStart(2, '0');
        const monthFormatted = String(expDate.getMonth() + 1).padStart(2, '0');
        const dateString = `${dayFormatted}.${monthFormatted}.${expDate.getFullYear()}`;

        // Link button (if defined)
        let linkBtnHtml = '';
        if (exp.link) {
            linkBtnHtml = `
                <a href="${exp.link}" target="_blank" rel="noopener noreferrer" class="btn-pay-link">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    <span>Сайт</span>
                </a>
            `;
        }

        // Type / Recurrence Badge (Subscription period vs One-time)
        const typeBadgeHtml = isSubscription
            ? `<span class="badge-type badge-type-subscription">${PERIOD_MAP[exp.period || 'monthly']}</span>`
            : `<span class="badge-type badge-type-onetime">Разовая</span>`;

        // Action controls (add play/pause for subscriptions)
        let toggleActiveBtn = '';
        if (isSubscription) {
            if (exp.active) {
                toggleActiveBtn = `
                    <button class="btn-card-action btn-toggle-active" title="Приостановить подписку">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                    </button>
                `;
            } else {
                toggleActiveBtn = `
                    <button class="btn-card-action btn-toggle-active" title="Активировать подписку">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    </button>
                `;
            }
        }

        // Billing detail or Suspended notice
        let billingHtml = '';
        if (isSuspended) {
            billingHtml = `
                <span class="billing-label">Статус:</span>
                <span class="billing-date" style="color: var(--text-muted);">Приостановлена</span>
            `;
        } else {
            billingHtml = `
                <span class="billing-label">${isSubscription ? 'Списание:' : 'Дата трат:'}</span>
                <span class="billing-date">${dateString}</span>
            `;
        }

        const paidLabel = exp.paid ? 'Оплачено' : 'Ожидает оплаты';

        // Comment block (always show, displaying "Нет описания" if empty)
        const commentBlockHtml = `
            <div class="card-comment-block" style="margin-top: 16px;">
                <div class="card-comment-text">${formatComment(exp.comment)}</div>
            </div>
        `;

        card.innerHTML = `
            <div>
                <div class="card-header-row">
                    <div class="card-title-group">
                        <div class="service-icon-box ${getCategoryBadgeClass(exp.category)}">
                            ${initials}
                        </div>
                        <div class="card-title-info">
                            <span class="expense-name" title="${exp.name}">${exp.name}</span>
                            <div>
                                <span class="badge-category ${getCategoryBadgeClass(exp.category)}">${CATEGORY_MAP[exp.category] || exp.category}</span>
                                ${typeBadgeHtml}
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-actions">
                        ${toggleActiveBtn}
                        <button class="btn-card-action btn-edit" title="Редактировать">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="btn-card-action btn-delete" title="Удалить">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </div>

                <div class="card-price-row">
                    <div>
                        <div class="expense-price">${displayPrice}</div>
                        ${convertedPriceHtml}
                    </div>
                    <div class="expense-billing-info">
                        ${billingHtml}
                    </div>
                </div>

                ${commentBlockHtml}
            </div>

            <div class="card-footer">
                ${linkBtnHtml}
                <div class="status-toggle-wrapper">
                    <span>${paidLabel}</span>
                    <label class="switch">
                        <input type="checkbox" class="toggle-paid-status" ${exp.paid ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
        `;

        // Event listener for Active/Pause status toggle
        if (isSubscription) {
            card.querySelector('.btn-toggle-active').addEventListener('click', () => {
                toggleActiveStatus(exp.id, !exp.active);
            });
        }

        // Event listener for Paid/Unpaid toggle
        card.querySelector('.toggle-paid-status').addEventListener('change', (e) => {
            togglePaidStatus(exp.id, e.target.checked);
        });

        // Event listener for Edit button
        card.querySelector('.btn-edit').addEventListener('click', () => {
            openExpenseModal(exp);
        });

        // Event listener for Delete button
        card.querySelector('.btn-delete').addEventListener('click', () => {
            deleteExpense(exp.id);
        });

        gridEl.appendChild(card);
    });
}

// ==========================================================================
// Operations & Modal Control
// ==========================================================================

function initEventListeners() {
    const monthDisplay = document.getElementById('current-month-display');
    const pickerDropdown = document.getElementById('month-picker-dropdown');
    let pickerDisplayedYear = state.currentYear;

    function openMonthPicker() {
        pickerDropdown.classList.remove('hidden');
        updateMonthPickerUI();
    }

    function closeMonthPicker() {
        pickerDropdown.classList.add('hidden');
    }

    function updateMonthPickerUI() {
        document.getElementById('picker-year-display').textContent = pickerDisplayedYear;
        const cells = document.querySelectorAll('.month-picker-cell');
        cells.forEach(cell => {
            const cellMonth = parseInt(cell.dataset.month);
            cell.classList.remove('active');
            if (cellMonth === state.currentMonth && pickerDisplayedYear === state.currentYear) {
                cell.classList.add('active');
            }
        });
    }

    // Month switching
    document.getElementById('prev-month').addEventListener('click', () => {
        closeMonthPicker();
        changeMonth(-1);
    });
    document.getElementById('next-month').addEventListener('click', () => {
        closeMonthPicker();
        changeMonth(1);
    });

    monthDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = pickerDropdown.classList.contains('hidden');
        if (isHidden) {
            pickerDisplayedYear = state.currentYear;
            openMonthPicker();
        } else {
            closeMonthPicker();
        }
    });

    document.getElementById('picker-prev-year').addEventListener('click', (e) => {
        e.stopPropagation();
        pickerDisplayedYear--;
        updateMonthPickerUI();
    });

    document.getElementById('picker-next-year').addEventListener('click', (e) => {
        e.stopPropagation();
        pickerDisplayedYear++;
        updateMonthPickerUI();
    });

    document.querySelectorAll('.month-picker-cell').forEach(cell => {
        cell.addEventListener('click', (e) => {
            e.stopPropagation();
            const selectedMonth = parseInt(cell.dataset.month);
            state.currentMonth = selectedMonth;
            state.currentYear = pickerDisplayedYear;
            saveStateToStorage();
            closeMonthPicker();
            updateUI();
        });
    });

    document.addEventListener('click', (e) => {
        if (!pickerDropdown.classList.contains('hidden')) {
            const isClickInside = pickerDropdown.contains(e.target) || monthDisplay.contains(e.target);
            if (!isClickInside) {
                closeMonthPicker();
            }
        }
    });

    // Global currency switching
    document.getElementById('global-currency-select').addEventListener('change', (e) => {
        state.globalCurrency = e.target.value;
        if (state.authMode === 'supabase' && state.currentUser) {
            saveSettingsToSupabase();
        }
        saveStateToStorage();
        updateUI();
    });

    // Search, Category, and Sort filtering
    document.getElementById('search-input').addEventListener('input', (e) => {
        state.filters.search = e.target.value;
        renderDashboardActiveView();
    });
    document.getElementById('category-filter').addEventListener('change', (e) => {
        state.filters.category = e.target.value;
        renderDashboardActiveView();
    });
    document.getElementById('sort-by-select').addEventListener('change', (e) => {
        state.filters.sortBy = e.target.value;
        renderDashboardActiveView();
    });

    document.getElementById('hide-paid-toggle').addEventListener('change', (e) => {
        state.filters.hidePaid = e.target.checked;
        renderDashboardActiveView();
    });

    // Donut Chart View Toggle event listeners
    document.getElementById('chart-toggle-all').addEventListener('click', () => {
        state.chartMode = 'all';
        saveStateToStorage();
        updateUI();
    });
    document.getElementById('chart-toggle-paid').addEventListener('click', () => {
        state.chartMode = 'paid';
        saveStateToStorage();
        updateUI();
    });

    // Floating action button / Add expense trigger
    document.getElementById('btn-add-expense').addEventListener('click', () => {
        openExpenseModal();
    });

    // Modal Expense cancel / close
    document.getElementById('modal-close-btn').addEventListener('click', closeExpenseModal);
    document.getElementById('btn-cancel-expense').addEventListener('click', closeExpenseModal);
    document.getElementById('expense-modal').addEventListener('click', (e) => {
        if (e.target.id === 'expense-modal') closeExpenseModal();
    });

    // Submit expense form
    document.getElementById('expense-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveExpenseForm();
    });

    // Budget modal triggers
    document.getElementById('btn-edit-budget').addEventListener('click', openBudgetModal);
    document.getElementById('budget-modal-close-btn').addEventListener('click', closeBudgetModal);
    document.getElementById('btn-cancel-budget').addEventListener('click', closeBudgetModal);
    document.getElementById('budget-modal').addEventListener('click', (e) => {
        if (e.target.id === 'budget-modal') closeBudgetModal();
    });

    // Submit budget form
    document.getElementById('budget-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveBudgetForm();
    });

    // Custom Deletion Confirm Modal events
    document.getElementById('delete-modal-close-btn').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-cancel-delete').addEventListener('click', closeDeleteModal);
    document.getElementById('delete-confirm-modal').addEventListener('click', (e) => {
        if (e.target.id === 'delete-confirm-modal') closeDeleteModal();
    });

    document.getElementById('btn-delete-all').addEventListener('click', () => {
        executeDeleteAll();
    });
    document.getElementById('btn-delete-current').addEventListener('click', () => {
        executeDeleteCurrent();
    });

    // Settings Modal Triggers
    document.getElementById('nav-settings').addEventListener('click', (e) => {
        e.preventDefault();
        openSettingsModal();
    });
    document.getElementById('settings-modal-close-btn').addEventListener('click', closeSettingsModal);
    document.getElementById('settings-modal').addEventListener('click', (e) => {
        if (e.target.id === 'settings-modal') closeSettingsModal();
    });

    // Settings logic (save rates)
    document.getElementById('btn-save-settings').addEventListener('click', () => {
        saveSettingsForm();
    });

    // Settings backup triggers
    document.getElementById('btn-export-data').addEventListener('click', () => {
        exportData();
    });
    document.getElementById('btn-trigger-import').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', (e) => {
        importData(e);
    });

    // Tab switching event listeners
    document.getElementById('nav-dashboard').addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('dashboard');
    });
    document.getElementById('nav-subscriptions').addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('subscriptions');
    });

    const navAnalytics = document.getElementById('nav-analytics');
    if (navAnalytics) {
        navAnalytics.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('analytics');
        });
    }

    // View mode toggle listeners
    const toggleCardsBtn = document.getElementById('view-toggle-cards');
    const toggleCalBtn = document.getElementById('view-toggle-calendar');
    if (toggleCardsBtn && toggleCalBtn) {
        toggleCardsBtn.addEventListener('click', () => {
            toggleDashboardViewMode('cards');
        });
        toggleCalBtn.addEventListener('click', () => {
            toggleDashboardViewMode('calendar');
        });
    }

    // ICS Export button listener
    const exportIcsBtn = document.getElementById('btn-export-ics');
    if (exportIcsBtn) {
        exportIcsBtn.addEventListener('click', () => {
            exportToICS();
        });
    }

    // CSV Export button listener
    const exportCsvBtn = document.getElementById('btn-export-csv');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            exportToCSV();
        });
    }

    // Start Tour button listener
    const startTourBtn = document.getElementById('btn-start-tour');
    if (startTourBtn) {
        startTourBtn.addEventListener('click', () => {
            closeSettingsModal();
            startOnboardingTour();
        });
    }



    document.getElementById('btn-add-subscription-tab').addEventListener('click', () => {
        openExpenseModal();
    });
    document.getElementById('sub-search-input').addEventListener('input', () => {
        renderSubscriptionsTable();
    });
    document.getElementById('sub-category-filter').addEventListener('change', () => {
        renderSubscriptionsTable();
    });

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (state.authMode === 'supabase' && supabaseClient) {
                try {
                    await supabaseClient.auth.signOut();
                } catch (err) {
                    console.error('Error signing out:', err);
                }
            }
            state.currentUser = null;
            state.authMode = 'ask';
            localStorage.setItem('finchaos_auth_mode', 'ask');
            window.location.reload();
        });
    }

    const autoUpdateCheckbox = document.getElementById('rates-auto-update-input');
    if (autoUpdateCheckbox) {
        autoUpdateCheckbox.addEventListener('change', syncRatesInputState);
    }

    const btnAddCategory = document.getElementById('btn-add-category');
    if (btnAddCategory) {
        btnAddCategory.addEventListener('click', addCategory);
    }
    const newCategoryInput = document.getElementById('new-category-name');
    if (newCategoryInput) {
        newCategoryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                addCategory();
            }
        });
    }
}

function changeMonth(delta) {
    state.currentMonth += delta;
    if (state.currentMonth < 0) {
        state.currentMonth = 11;
        state.currentYear--;
    } else if (state.currentMonth > 11) {
        state.currentMonth = 0;
        state.currentYear++;
    }
    updateUI();
}

// ==========================================================================
// Modal Expense Actions
// ==========================================================================

function openExpenseModal(expense = null) {
    const modalEl = document.getElementById('expense-modal');
    const formEl = document.getElementById('expense-form');
    const titleEl = document.getElementById('modal-title');
    const typeRadios = document.querySelectorAll('input[name="expense-type"]');
    const periodGroup = document.getElementById('subscription-period-group');

    formEl.reset();

    // Set default date to current selected month / year
    const today = new Date();
    let dateStr = '';
    if (state.currentYear === today.getFullYear() && state.currentMonth === today.getMonth()) {
        const dStr = String(today.getDate()).padStart(2, '0');
        const mStr = String(state.currentMonth + 1).padStart(2, '0');
        dateStr = `${state.currentYear}-${mStr}-${dStr}`;
    } else {
        const mStr = String(state.currentMonth + 1).padStart(2, '0');
        dateStr = `${state.currentYear}-${mStr}-01`;
    }

    document.getElementById('expense-date').value = dateStr;

    // Toggle visibility function
    function togglePeriodVisibility() {
        const selectedType = document.querySelector('input[name="expense-type"]:checked').value;
        const propagateGroup = document.getElementById('propagate-sub-changes-group');
        const isEditing = document.getElementById('expense-id').value !== '';

        if (selectedType === 'subscription') {
            periodGroup.classList.remove('hidden');
            if (isEditing && propagateGroup) {
                propagateGroup.classList.remove('hidden');
            } else if (propagateGroup) {
                propagateGroup.classList.add('hidden');
            }
        } else {
            periodGroup.classList.add('hidden');
            if (propagateGroup) {
                propagateGroup.classList.add('hidden');
            }
        }
    }

    // Attach listener for dynamic toggling of the period selector
    typeRadios.forEach(radio => {
        radio.removeEventListener('change', togglePeriodVisibility);
        radio.addEventListener('change', togglePeriodVisibility);
    });

    if (expense) {
        titleEl.textContent = 'Редактировать трату';
        document.getElementById('expense-id').value = expense.id;
        document.getElementById('expense-name').value = expense.name;
        document.getElementById('expense-amount').value = expense.amount;
        document.getElementById('expense-currency').value = expense.currency;
        document.getElementById('expense-category').value = expense.category;
        document.getElementById('expense-date').value = expense.date;
        document.getElementById('expense-link').value = expense.link || '';
        document.getElementById('expense-comment').value = expense.comment || '';

        // Select correct radio button
        const expType = expense.type || 'subscription';
        document.querySelector(`input[name="expense-type"][value="${expType}"]`).checked = true;

        // Set period select
        document.getElementById('expense-period').value = expense.period || 'monthly';
    } else {
        titleEl.textContent = 'Добавить трату';
        document.getElementById('expense-id').value = '';
        document.getElementById('expense-period').value = 'monthly';
        document.querySelector('input[name="expense-type"][value="subscription"]').checked = true;
    }

    // Initialize visibility on open
    togglePeriodVisibility();

    modalEl.classList.add('active');
    document.getElementById('expense-name').focus();
}

function closeExpenseModal() {
    document.getElementById('expense-modal').classList.remove('active');
}

function saveExpenseForm() {
    const id = document.getElementById('expense-id').value;
    const name = document.getElementById('expense-name').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const currency = document.getElementById('expense-currency').value;
    const category = document.getElementById('expense-category').value;
    const date = document.getElementById('expense-date').value;
    const link = document.getElementById('expense-link').value.trim();
    const comment = document.getElementById('expense-comment').value.trim();
    const type = document.querySelector('input[name="expense-type"]:checked').value;
    const period = type === 'subscription' ? document.getElementById('expense-period').value : null;

    if (!name || isNaN(amount) || !date) return;

    if (state.authMode === 'supabase' && state.currentUser) {
        const userId = state.currentUser.id;
        if (id) {
            // Edit mode
            const index = state.expenses.findIndex(exp => exp.id === id);
            if (index !== -1) {
                const oldType = state.expenses[index].type;
                let subId = state.expenses[index].subscriptionId;
                let isActive = state.expenses[index].active !== undefined ? state.expenses[index].active : true;
                let isPaid = state.expenses[index].paid !== undefined ? state.expenses[index].paid : false;

                if (oldType !== type) {
                    if (type === 'subscription') {
                        subId = 'sub-' + Date.now();
                        isActive = true;
                        isPaid = false;
                    } else {
                        subId = null;
                        isActive = true;
                        isPaid = true;
                    }
                }

                const propagateGroup = document.getElementById('propagate-sub-changes');
                const propagate = propagateGroup ? propagateGroup.checked : false;

                if (type === 'subscription' && propagate && subId) {
                    const newDateObj = new Date(date);
                    const newDay = newDateObj.getDate();

                    const updatePromises = state.expenses.map(async (exp) => {
                        if (exp.subscriptionId === subId) {
                            exp.name = name;
                            exp.amount = amount;
                            exp.currency = currency;
                            exp.category = category;
                            exp.period = period;
                            exp.link = link;
                            exp.comment = comment;

                            const instDate = new Date(exp.date);
                            const lastDayOfInstMonth = new Date(instDate.getFullYear(), instDate.getMonth() + 1, 0).getDate();
                            const adjustedDay = Math.min(newDay, lastDayOfInstMonth);
                            const mStr = String(instDate.getMonth() + 1).padStart(2, '0');
                            const dStr = String(adjustedDay).padStart(2, '0');
                            exp.date = `${instDate.getFullYear()}-${mStr}-${dStr}`;

                            return supabaseClient.from('expenses').update({
                                name: exp.name,
                                amount: exp.amount,
                                currency: exp.currency,
                                category: exp.category,
                                period: exp.period,
                                link: exp.link,
                                comment: exp.comment,
                                date: exp.date
                            }).eq('id', exp.id);
                        }
                    }).filter(Boolean);

                    Promise.all(updatePromises).catch(err => console.error(err));
                } else {
                    const updatedObj = {
                        ...state.expenses[index],
                        name, amount, currency, category, date, link, comment,
                        type, period, subscriptionId: subId, active: isActive, paid: isPaid
                    };
                    state.expenses[index] = updatedObj;

                    supabaseClient.from('expenses').update({
                        name: updatedObj.name,
                        amount: updatedObj.amount,
                        currency: updatedObj.currency,
                        category: updatedObj.category,
                        date: updatedObj.date,
                        link: updatedObj.link,
                        comment: updatedObj.comment,
                        type: updatedObj.type,
                        period: updatedObj.period,
                        subscription_id: updatedObj.subscriptionId,
                        active: updatedObj.active,
                        paid: updatedObj.paid
                    }).eq('id', id).then(({ error }) => { if (error) console.error(error); });
                }
            }
        } else {
            // Add mode
            const isSub = type === 'subscription';
            const newExpense = {
                id: 'exp-' + Date.now() + Math.random().toString(36).substr(2, 5),
                subscriptionId: isSub ? 'sub-' + Date.now() : null,
                type,
                period,
                name,
                amount,
                currency,
                category,
                date,
                link,
                comment,
                active: true,
                paid: !isSub
            };
            state.expenses.push(newExpense);

            supabaseClient.from('expenses').insert({
                id: newExpense.id,
                user_id: userId,
                subscription_id: newExpense.subscriptionId,
                type: newExpense.type,
                period: newExpense.period,
                name: newExpense.name,
                amount: newExpense.amount,
                currency: newExpense.currency,
                category: newExpense.category,
                date: newExpense.date,
                link: newExpense.link,
                comment: newExpense.comment,
                active: newExpense.active,
                paid: newExpense.paid,
                deleted: false
            }).then(({ error }) => { if (error) console.error(error); });
        }
    } else {
        // Demo mode (LocalStorage)
        if (id) {
            const index = state.expenses.findIndex(exp => exp.id === id);
            if (index !== -1) {
                const oldType = state.expenses[index].type;
                let subId = state.expenses[index].subscriptionId;
                let isActive = state.expenses[index].active !== undefined ? state.expenses[index].active : true;
                let isPaid = state.expenses[index].paid !== undefined ? state.expenses[index].paid : false;

                if (oldType !== type) {
                    if (type === 'subscription') {
                        subId = 'sub-' + Date.now();
                        isActive = true;
                        isPaid = false;
                    } else {
                        subId = null;
                        isActive = true;
                        isPaid = true;
                    }
                }

                const propagateGroup = document.getElementById('propagate-sub-changes');
                const propagate = propagateGroup ? propagateGroup.checked : false;

                if (type === 'subscription' && propagate && subId) {
                    const newDateObj = new Date(date);
                    const newDay = newDateObj.getDate();

                    state.expenses.forEach(exp => {
                        if (exp.subscriptionId === subId) {
                            exp.name = name;
                            exp.amount = amount;
                            exp.currency = currency;
                            exp.category = category;
                            exp.period = period;
                            exp.link = link;
                            exp.comment = comment;

                            const instDate = new Date(exp.date);
                            const lastDayOfInstMonth = new Date(instDate.getFullYear(), instDate.getMonth() + 1, 0).getDate();
                            const adjustedDay = Math.min(newDay, lastDayOfInstMonth);
                            const mStr = String(instDate.getMonth() + 1).padStart(2, '0');
                            const dStr = String(adjustedDay).padStart(2, '0');
                            exp.date = `${instDate.getFullYear()}-${mStr}-${dStr}`;
                        }
                    });
                } else {
                    state.expenses[index] = {
                        ...state.expenses[index],
                        name, amount, currency, category, date, link, comment,
                        type, period, subscriptionId: subId, active: isActive, paid: isPaid
                    };
                }
            }
        } else {
            const isSub = type === 'subscription';
            const newExpense = {
                id: 'exp-' + Date.now() + Math.random().toString(36).substr(2, 5),
                subscriptionId: isSub ? 'sub-' + Date.now() : null,
                type,
                period,
                name,
                amount,
                currency,
                category,
                date,
                link,
                comment,
                active: true,
                paid: !isSub
            };
            state.expenses.push(newExpense);
        }
    }

    saveStateToStorage();
    closeExpenseModal();
    updateUI();
}

function deleteExpense(id) {
    const expense = state.expenses.find(exp => exp.id === id);
    if (!expense) return;

    if (expense.type === 'subscription' && expense.subscriptionId) {
        // Show custom modal with multiple choices for subscriptions
        state.deleteTargetId = id;
        state.deleteTargetSubId = expense.subscriptionId;
        document.getElementById('delete-confirm-modal').classList.add('active');
    } else {
        // Show standard confirm for one-time purchases
        if (confirm('Вы уверены, что хотите удалить эту разовую покупку?')) {
            if (state.authMode === 'supabase' && state.currentUser) {
                supabaseClient.from('expenses').delete().eq('id', id)
                    .then(({ error }) => { if (error) console.error('Error deleting expense from Supabase:', error); });
            }
            state.expenses = state.expenses.filter(exp => exp.id !== id);
            saveStateToStorage();
            updateUI();
        }
    }
}

function closeDeleteModal() {
    document.getElementById('delete-confirm-modal').classList.remove('active');
    state.deleteTargetId = null;
    state.deleteTargetSubId = null;
}

// Delete this subscription from ALL months in history and future
function executeDeleteAll() {
    if (state.deleteTargetSubId) {
        if (state.authMode === 'supabase' && state.currentUser) {
            supabaseClient.from('expenses').delete().eq('subscription_id', state.deleteTargetSubId)
                .then(({ error }) => { if (error) console.error('Error deleting all subscription instances from Supabase:', error); });
        }
        state.expenses = state.expenses.filter(exp => exp.subscriptionId !== state.deleteTargetSubId);
        saveStateToStorage();
        closeDeleteModal();
        updateUI();
    }
}

// Mark this subscription as deleted ONLY for the current month.
function executeDeleteCurrent() {
    if (state.deleteTargetId) {
        const index = state.expenses.findIndex(exp => exp.id === state.deleteTargetId);
        if (index !== -1) {
            state.expenses[index].deleted = true;
            if (state.authMode === 'supabase' && state.currentUser) {
                supabaseClient.from('expenses').update({ deleted: true }).eq('id', state.deleteTargetId)
                    .then(({ error }) => { if (error) console.error('Error updating deleted state in Supabase:', error); });
            }
        }
        saveStateToStorage();
        closeDeleteModal();
        updateUI();
    }
}

function toggleActiveStatus(id, isActive) {
    const index = state.expenses.findIndex(exp => exp.id === id);
    if (index !== -1) {
        state.expenses[index].active = isActive;
        if (state.authMode === 'supabase' && state.currentUser) {
            supabaseClient.from('expenses').update({ active: isActive }).eq('id', id)
                .then(({ error }) => { if (error) console.error('Error toggling active status in Supabase:', error); });
        }
        saveStateToStorage();
        updateUI();
    }
}

// Global toggle for all instances of a subscription
function toggleSubActiveGlobal(subId) {
    const instances = state.expenses.filter(exp => exp.subscriptionId === subId);
    if (instances.length === 0) return;

    const currentActive = instances[0].active;
    const targetActive = (currentActive === undefined) ? false : !currentActive;

    state.expenses.forEach(exp => {
        if (exp.subscriptionId === subId) {
            exp.active = targetActive;
        }
    });

    if (state.authMode === 'supabase' && state.currentUser) {
        supabaseClient.from('expenses').update({ active: targetActive }).eq('subscription_id', subId)
            .then(({ error }) => { if (error) console.error('Error toggling global subscription active in Supabase:', error); });
    }

    saveStateToStorage();
    updateUI();
}
window.toggleSubActiveGlobal = toggleSubActiveGlobal;

function togglePaidStatus(id, isPaid) {
    const index = state.expenses.findIndex(exp => exp.id === id);
    if (index !== -1) {
        state.expenses[index].paid = isPaid;
        if (state.authMode === 'supabase' && state.currentUser) {
            supabaseClient.from('expenses').update({ paid: isPaid }).eq('id', id)
                .then(({ error }) => { if (error) console.error('Error toggling paid status in Supabase:', error); });
        }
        saveStateToStorage();
        updateUI();
    }
}

// ==========================================================================
// Settings Modal Actions
// ==========================================================================

function syncRatesInputState() {
    const autoUpdateCheckbox = document.getElementById('rates-auto-update-input');
    const autoUpdate = autoUpdateCheckbox ? autoUpdateCheckbox.checked : false;
    const usdInput = document.getElementById('rate-usd-input');
    const eurInput = document.getElementById('rate-eur-input');
    
    if (usdInput && eurInput) {
        usdInput.disabled = autoUpdate;
        eurInput.disabled = autoUpdate;
    }
}
window.syncRatesInputState = syncRatesInputState;

function openSettingsModal() {
    const modalEl = document.getElementById('settings-modal');
    const autoUpdate = localStorage.getItem('finchaos_rates_auto_update') !== 'false';
    const autoUpdateCheckbox = document.getElementById('rates-auto-update-input');
    
    if (autoUpdateCheckbox) {
        autoUpdateCheckbox.checked = autoUpdate;
    }
    
    document.getElementById('rate-usd-input').value = state.rates.USD;
    document.getElementById('rate-eur-input').value = state.rates.EUR;
    
    syncRatesInputState();
    renderSettingsCategories();
    initCategoryColorPicker();
    modalEl.classList.add('active');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.remove('active');
}

function saveSettingsForm() {
    const autoUpdateCheckbox = document.getElementById('rates-auto-update-input');
    const autoUpdate = autoUpdateCheckbox ? autoUpdateCheckbox.checked : false;
    localStorage.setItem('finchaos_rates_auto_update', autoUpdate ? 'true' : 'false');

    if (!autoUpdate) {
        const usd = parseFloat(document.getElementById('rate-usd-input').value);
        const eur = parseFloat(document.getElementById('rate-eur-input').value);

        if (isNaN(usd) || usd <= 0 || isNaN(eur) || eur <= 0) {
            alert('Курсы валют должны быть положительными числами!');
            return;
        }

        state.rates.USD = usd;
        state.rates.EUR = eur;

        if (state.authMode === 'supabase' && state.currentUser) {
            saveSettingsToSupabase();
        }

        saveStateToStorage();
        closeSettingsModal();
        updateUI();
    } else {
        closeSettingsModal();
        loadExchangeRates();
    }
}

function exportData() {
    const customCategories = {};
    Object.keys(state.categories).forEach(id => {
        if (!state.categories[id].system) {
            customCategories[id] = state.categories[id];
        }
    });

    const backup = {
        expenses: state.expenses,
        budgets: state.budgets,
        rates: state.rates,
        globalCurrency: state.globalCurrency,
        customCategories: customCategories
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `finchaos_backup_${getCurrentMonthKey()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (evt) {
        try {
            const parsed = JSON.parse(evt.target.result);
            if (parsed && Array.isArray(parsed.expenses)) {
                // Restore custom categories if they exist in backup
                if (parsed.customCategories) {
                    localStorage.setItem('finchaos_custom_categories', JSON.stringify(parsed.customCategories));
                    initCategories();
                    populateCategoryDropdowns();
                }

                // Generate fresh unique IDs to avoid primary key conflicts
                const remappedExpenses = remapIds(parsed.expenses);
                state.expenses = remappedExpenses;
                state.budgets = parsed.budgets || {};
                state.rates = parsed.rates || { ...DEFAULT_RATES };
                if (parsed.globalCurrency) {
                    state.globalCurrency = parsed.globalCurrency;
                    document.getElementById('global-currency-select').value = parsed.globalCurrency;
                }

                saveStateToStorage();

                if (state.authMode === 'supabase' && state.currentUser) {
                    const userId = state.currentUser.id;
                    try {
                        // Clear old cloud records to overwrite with imported file
                        await supabaseClient.from('expenses').delete().eq('user_id', userId);
                        await supabaseClient.from('budgets').delete().eq('user_id', userId);

                        // Upload expenses
                        if (state.expenses.length > 0) {
                            const dbRows = state.expenses.map(exp => ({
                                id: exp.id,
                                user_id: userId,
                                subscription_id: exp.subscriptionId,
                                type: exp.type || 'subscription',
                                period: exp.period || 'monthly',
                                name: exp.name,
                                amount: exp.amount,
                                currency: exp.currency,
                                category: exp.category,
                                date: exp.date,
                                link: exp.link,
                                comment: exp.comment,
                                active: exp.active !== undefined ? exp.active : true,
                                paid: exp.paid !== undefined ? exp.paid : false,
                                deleted: exp.deleted !== undefined ? exp.deleted : false
                            }));

                            const chunkSize = 50;
                            for (let i = 0; i < dbRows.length; i += chunkSize) {
                                const chunk = dbRows.slice(i, i + chunkSize);
                                await supabaseClient.from('expenses').insert(chunk);
                            }
                        }

                        // Upload budgets
                        const dbBudgets = Object.keys(state.budgets).map(key => ({
                            user_id: userId,
                            month_key: key,
                            limit_val: state.budgets[key]
                        }));
                        if (dbBudgets.length > 0) {
                            await supabaseClient.from('budgets').upsert(dbBudgets);
                        }

                        // Save settings
                        await saveSettingsToSupabase();
                    } catch (dbErr) {
                        console.error('Failed to sync imported data to Supabase:', dbErr);
                        alert('Локально данные импортированы, но не удалось отправить их в облако: ' + dbErr.message);
                    }
                }

                alert('Данные успешно импортированы!');
                closeSettingsModal();
                updateUI();
            } else {
                alert('Некорректный формат файла бэкапа! Отсутствует список расходов.');
            }
        } catch (err) {
            alert('Ошибка разбора JSON-файла: ' + err.message);
        }
    };
    reader.readAsText(file);

    // Clear value to allow re-upload of same file
    e.target.value = '';
}

// ==========================================================================
// Modal Budget Actions
// ==========================================================================

function openBudgetModal() {
    const modalEl = document.getElementById('budget-modal');
    const monthKey = getCurrentMonthKey();
    const currentLimit = state.budgets[monthKey] || 0;

    document.getElementById('budget-limit-input').value = currentLimit > 0 ? currentLimit : '';
    document.getElementById('budget-currency-label').textContent =
        state.globalCurrency === 'RUB' ? '₽' : (state.globalCurrency === 'USD' ? '$' : '€');

    modalEl.classList.add('active');
    document.getElementById('budget-limit-input').focus();
}

function closeBudgetModal() {
    document.getElementById('budget-modal').classList.remove('active');
}

function saveBudgetForm() {
    const limit = parseFloat(document.getElementById('budget-limit-input').value);
    if (isNaN(limit) || limit < 0) return;

    const monthKey = getCurrentMonthKey();
    state.budgets[monthKey] = limit;

    if (state.authMode === 'supabase' && state.currentUser) {
        supabaseClient.from('budgets').upsert({
            user_id: state.currentUser.id,
            month_key: monthKey,
            limit_val: limit
        }).then(({ error }) => { if (error) console.error('Error saving budget to Supabase:', error); });
    }

    saveStateToStorage();
    closeBudgetModal();
    updateUI();
}

// ==========================================================================
// Subscriptions Tab Management & Global Synchronization
// ==========================================================================

function switchTab(tabName) {
    state.activeTab = tabName;

    const navDashboard = document.getElementById('nav-dashboard');
    const navSubs = document.getElementById('nav-subscriptions');
    const navAnalytics = document.getElementById('nav-analytics');

    const viewDashboard = document.getElementById('view-dashboard');
    const viewSubs = document.getElementById('view-subscriptions');
    const viewAnalytics = document.getElementById('view-analytics');

    // Reset active nav items
    navDashboard.classList.remove('active');
    navSubs.classList.remove('active');
    if (navAnalytics) navAnalytics.classList.remove('active');

    // Hide all views
    viewDashboard.classList.add('hidden');
    viewSubs.classList.add('hidden');
    if (viewAnalytics) viewAnalytics.classList.add('hidden');

    if (tabName === 'dashboard') {
        navDashboard.classList.add('active');
        viewDashboard.classList.remove('hidden');
        updateUI();
    } else if (tabName === 'subscriptions') {
        navSubs.classList.add('active');
        viewSubs.classList.remove('hidden');
        renderSubscriptionsTable();
    } else if (tabName === 'analytics') {
        if (navAnalytics) navAnalytics.classList.add('active');
        if (viewAnalytics) viewAnalytics.classList.remove('hidden');
        renderAnalyticsTab();
    }
}

function getUniqueSubscriptions() {
    const subsMap = {};

    state.expenses.forEach(exp => {
        if (exp.type === 'subscription' && exp.subscriptionId && !exp.deleted) {
            const subId = exp.subscriptionId;
            if (!subsMap[subId] || new Date(exp.date) > new Date(subsMap[subId].date)) {
                subsMap[subId] = exp;
            }
        }
    });

    return Object.values(subsMap);
}

function getNextBillingDateForSub(subId) {
    const instances = state.expenses.filter(exp => exp.subscriptionId === subId && !exp.deleted);
    if (instances.length === 0) return null;

    const dates = instances.map(exp => new Date(exp.date));
    const latestDate = new Date(Math.max(...dates));

    const latestInstance = instances.find(exp => new Date(exp.date).getTime() === latestDate.getTime());
    const period = latestInstance.period || 'monthly';

    const nextDate = new Date(latestDate);
    if (period === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (period === 'quarterly') {
        nextDate.setMonth(nextDate.getMonth() + 3);
    } else if (period === 'semi-annually') {
        nextDate.setMonth(nextDate.getMonth() + 6);
    } else if (period === 'annually') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
    }

    return nextDate;
}

function formatDateString(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}.${m}.${date.getFullYear()}`;
}

function renderSubscriptionsTable() {
    const tableBody = document.getElementById('subscriptions-table-body');
    const emptyView = document.getElementById('sub-table-empty-view');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    let subs = getUniqueSubscriptions();

    const searchQuery = (document.getElementById('sub-search-input')?.value || '').trim().toLowerCase();
    const categoryQuery = document.getElementById('sub-category-filter')?.value || 'all';

    // Filter by category
    if (categoryQuery !== 'all') {
        subs = subs.filter(sub => sub.category === categoryQuery);
    }

    // Filter by search query
    if (searchQuery !== '') {
        subs = subs.filter(sub =>
            sub.name.toLowerCase().includes(searchQuery) ||
            (sub.comment && sub.comment.toLowerCase().includes(searchQuery))
        );
    }

    subs.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    if (subs.length === 0) {
        document.querySelector('.subscriptions-table').style.display = 'none';
        emptyView.classList.remove('hidden');
        return;
    }

    document.querySelector('.subscriptions-table').style.display = '';
    emptyView.classList.add('hidden');

    subs.forEach(sub => {
        const priceStr = formatCurrency(sub.amount, sub.currency);
        const nextDate = getNextBillingDateForSub(sub.subscriptionId);
        const nextDateStr = nextDate ? formatDateString(nextDate) : 'Нет сведений';

        const statusText = sub.active ? 'Активна' : 'Пауза';
        const statusClass = sub.active ? 'badge-days-far' : 'badge-days-later';

        const row = document.createElement('tr');
        row.dataset.subId = sub.subscriptionId;

        const nameHtml = sub.link
            ? `<a href="${sub.link}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); font-weight: 600; text-decoration: none;">${sub.name}</a>`
            : `<span style="font-weight: 600; color: var(--text-primary);">${sub.name}</span>`;

        row.innerHTML = `
            <td>
                <div style="display: flex; flex-direction: column;">
                    ${nameHtml}
                    <span style="font-size: 12px; color: var(--text-muted); max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${sub.comment || ''}">${sub.comment || 'Нет комментария'}</span>
                </div>
            </td>
            <td>
                <span class="badge-category ${getCategoryBadgeClass(sub.category)}">${CATEGORY_MAP[sub.category] || sub.category}</span>
            </td>
            <td>
                <span class="badge-type badge-type-subscription">${PERIOD_MAP[sub.period || 'monthly']}</span>
            </td>
            <td>
                <div style="font-weight: 700; color: var(--text-primary);">${priceStr}</div>
            </td>
            <td>
                <span class="upcoming-days-badge ${statusClass}" style="cursor: pointer; display: inline-block;" onclick="toggleSubActiveGlobal('${sub.subscriptionId}')" title="Нажмите для переключения статуса">${statusText}</span>
            </td>
            <td style="text-align: right;">
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="btn-card-action btn-edit" onclick="editSubGlobal('${sub.id}')" title="Редактировать во всех месяцах">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-card-action btn-delete" onclick="deleteSubGlobal('${sub.id}')" title="Удалить подписку везде">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

function toggleSubActiveGlobal(subId) {
    const instances = state.expenses.filter(exp => exp.subscriptionId === subId);
    if (instances.length === 0) return;

    const currentActive = instances[0].active;
    const targetActive = (currentActive === undefined) ? false : !currentActive;

    state.expenses.forEach(exp => {
        if (exp.subscriptionId === subId) {
            exp.active = targetActive;
        }
    });

    saveStateToStorage();
    updateUI();
}

function editSubGlobal(id) {
    const expense = state.expenses.find(exp => exp.id === id);
    if (!expense) return;

    openExpenseModal(expense);

    const propagateGroup = document.getElementById('propagate-sub-changes-group');
    const propagateCheck = document.getElementById('propagate-sub-changes');
    if (propagateGroup && propagateCheck) {
        propagateGroup.classList.remove('hidden');
        propagateCheck.checked = true;
    }
}

function deleteSubGlobal(id) {
    const expense = state.expenses.find(exp => exp.id === id);
    if (!expense) return;

    if (confirm(`Вы действительно хотите полностью удалить подписку "${expense.name}" из всех месяцев?`)) {
        state.expenses = state.expenses.filter(exp => exp.subscriptionId !== expense.subscriptionId);
        saveStateToStorage();
        updateUI();
    }
}

// Bind to window to allow inline html triggers
window.toggleSubActiveGlobal = toggleSubActiveGlobal;
window.editSubGlobal = editSubGlobal;
window.deleteSubGlobal = deleteSubGlobal;

// ==========================================================================
// Calendar View Renderer
// ==========================================================================
function renderCalendarView(currentMonthExpenses) {
    const calendarGridBody = document.getElementById('calendar-grid-body');
    if (!calendarGridBody) return;

    calendarGridBody.innerHTML = '';

    // Filter expenses using current filters
    let filtered = [...currentMonthExpenses];
    if (state.filters.category !== 'all') {
        filtered = filtered.filter(exp => exp.category === state.filters.category);
    }
    if (state.filters.search.trim() !== '') {
        const query = state.filters.search.toLowerCase();
        filtered = filtered.filter(exp =>
            exp.name.toLowerCase().includes(query) ||
            (exp.comment && exp.comment.toLowerCase().includes(query))
        );
    }

    if (state.filters.hidePaid) {
        filtered = filtered.filter(exp => !exp.paid);
    }

    // Group filtered expenses by day
    const expensesByDay = {};
    filtered.forEach(exp => {
        const date = new Date(exp.date);
        const day = date.getDate();
        if (!expensesByDay[day]) {
            expensesByDay[day] = [];
        }
        expensesByDay[day].push(exp);
    });

    // Start of the month math
    const firstDayOfMonth = new Date(state.currentYear, state.currentMonth, 1);
    let startDayOfWeek = firstDayOfMonth.getDay() - 1; // Mon = 0
    if (startDayOfWeek < 0) startDayOfWeek = 6; // Sun = 6

    const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();

    const prevMonthYear = state.currentMonth === 0 ? state.currentYear - 1 : state.currentYear;
    const prevMonth = state.currentMonth === 0 ? 11 : state.currentMonth - 1;
    const daysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === state.currentYear && today.getMonth() === state.currentMonth;
    const todayDate = today.getDate();

    // 1. Prev month padding days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell other-month';
        cell.innerHTML = `<span class="calendar-day-number">${day}</span>`;
        calendarGridBody.appendChild(cell);
    }

    // 2. Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell';
        if (isCurrentMonth && day === todayDate) {
            cell.className += ' today';
        }

        const dayNumEl = document.createElement('span');
        dayNumEl.className = 'calendar-day-number';
        dayNumEl.textContent = day;
        cell.appendChild(dayNumEl);

        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'calendar-day-events';

        const dayExpenses = expensesByDay[day] || [];
        dayExpenses.sort((a, b) => {
            const valA = convertAmount(a.amount, a.currency, state.globalCurrency);
            const valB = convertAmount(b.amount, b.currency, state.globalCurrency);
            return valB - valA;
        });

        dayExpenses.forEach(exp => {
            const tag = document.createElement('div');
            const isSubscription = exp.type === 'subscription';
            const isSuspended = isSubscription && !exp.active;

            tag.className = `calendar-event-tag ${getCategoryBadgeClass(exp.category)} ${exp.paid ? 'paid' : 'unpaid'} ${isSuspended ? 'suspended' : ''}`;

            const priceStr = formatCurrency(exp.amount, exp.currency);
            tag.innerHTML = `
                <span class="event-name" title="${exp.name}">${exp.name}</span>
                <span class="event-price">${priceStr}</span>
            `;

            tag.addEventListener('click', (e) => {
                e.stopPropagation();
                openExpenseModal(exp);
            });

            eventsContainer.appendChild(tag);
        });

        cell.appendChild(eventsContainer);

        // Add new expense on cell click
        cell.addEventListener('click', () => {
            const formattedMonth = String(state.currentMonth + 1).padStart(2, '0');
            const formattedDay = String(day).padStart(2, '0');
            const selectedDateStr = `${state.currentYear}-${formattedMonth}-${formattedDay}`;

            const dummyExpense = {
                id: '',
                name: '',
                amount: '',
                currency: state.globalCurrency,
                category: 'software',
                date: selectedDateStr,
                type: 'subscription',
                period: 'monthly'
            };
            openExpenseModal(dummyExpense);
        });

        calendarGridBody.appendChild(cell);
    }

    // 3. Next month padding days
    const totalCells = startDayOfWeek + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let day = 1; day <= remainingCells; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell other-month';
        cell.innerHTML = `<span class="calendar-day-number">${day}</span>`;
        calendarGridBody.appendChild(cell);
    }
}

// ==========================================================================
// Analytics tab and Savings Simulator logic
// ==========================================================================
function getAnnualCostInGlobal(sub) {
    const amountInGlobal = convertAmount(sub.amount, sub.currency, state.globalCurrency);
    const period = sub.period || 'monthly';
    if (period === 'monthly') return amountInGlobal * 12;
    if (period === 'quarterly') return amountInGlobal * 4;
    if (period === 'semi-annually') return amountInGlobal * 2;
    if (period === 'annually') return amountInGlobal * 1;
    return amountInGlobal * 12;
}

function getMonthlyCostInGlobal(sub) {
    const amountInGlobal = convertAmount(sub.amount, sub.currency, state.globalCurrency);
    const period = sub.period || 'monthly';
    if (period === 'monthly') return amountInGlobal;
    if (period === 'quarterly') return amountInGlobal / 3;
    if (period === 'semi-annually') return amountInGlobal / 6;
    if (period === 'annually') return amountInGlobal / 12;
    return amountInGlobal;
}

function renderAnalyticsTab() {
    const forecastEl = document.getElementById('analytics-annual-forecast');
    const monthlyAverageEl = document.getElementById('analytics-monthly-average');
    const savingsEl = document.getElementById('analytics-savings-potential');
    const simListEl = document.getElementById('simulator-list');
    const rateUsdEl = document.getElementById('rate-usd-display');
    const rateEurEl = document.getElementById('rate-eur-display');

    if (!forecastEl || !simListEl) return;

    // Display current rates
    if (rateUsdEl) rateUsdEl.textContent = state.rates.USD;
    if (rateEurEl) rateEurEl.textContent = state.rates.EUR;

    const uniqueSubs = getUniqueSubscriptions().filter(sub => sub.active);

    // Render simulator items
    simListEl.innerHTML = '';

    if (uniqueSubs.length === 0) {
        simListEl.innerHTML = '<div style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 24px 0;">У вас нет активных подписок для симулятора трат.</div>';
        forecastEl.textContent = formatCurrency(0, state.globalCurrency);
        monthlyAverageEl.textContent = formatCurrency(0, state.globalCurrency);
        savingsEl.textContent = formatCurrency(0, state.globalCurrency);

        document.getElementById('sim-monthly-saved').textContent = formatCurrency(0, state.globalCurrency);
        document.getElementById('sim-annual-saved').textContent = formatCurrency(0, state.globalCurrency);
        document.getElementById('sim-new-annual-total').textContent = formatCurrency(0, state.globalCurrency);

        renderCurrencyDistribution([]);
        return;
    }

    uniqueSubs.sort((a, b) => {
        const valA = convertAmount(a.amount, a.currency, state.globalCurrency);
        const valB = convertAmount(b.amount, b.currency, state.globalCurrency);
        return valB - valA;
    });

    let totalMonthlyOriginal = 0;
    let totalAnnualOriginal = 0;

    uniqueSubs.forEach(sub => {
        totalMonthlyOriginal += getMonthlyCostInGlobal(sub);
        totalAnnualOriginal += getAnnualCostInGlobal(sub);
    });

    forecastEl.textContent = formatCurrency(totalAnnualOriginal, state.globalCurrency);
    monthlyAverageEl.textContent = formatCurrency(totalMonthlyOriginal, state.globalCurrency);

    uniqueSubs.forEach(sub => {
        const item = document.createElement('div');
        item.className = 'simulator-item';
        item.dataset.subId = sub.subscriptionId;

        const annualCost = getAnnualCostInGlobal(sub);

        const monthlyCostFormatted = formatCurrency(sub.amount, sub.currency);
        const annualCostInGlobalFormatted = formatCurrency(annualCost, state.globalCurrency);

        item.innerHTML = `
            <div class="simulator-item-left">
                <input type="checkbox" class="simulator-checkbox" checked data-sub-id="${sub.subscriptionId}">
                <div class="simulator-item-info">
                    <span class="simulator-item-name">${sub.name}</span>
                    <span class="simulator-item-meta">${PERIOD_MAP[sub.period || 'monthly']} • ${CATEGORY_MAP[sub.category]}</span>
                </div>
            </div>
            <div class="simulator-item-right">
                <div class="simulator-item-price">${monthlyCostFormatted} / мес</div>
                <div class="simulator-item-annual-price">≈ ${annualCostInGlobalFormatted} / год</div>
            </div>
        `;

        const checkbox = item.querySelector('.simulator-checkbox');
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                item.classList.remove('disabled');
            } else {
                item.classList.add('disabled');
            }
            recalculateSimulator(uniqueSubs, totalMonthlyOriginal, totalAnnualOriginal);
        });

        simListEl.appendChild(item);
    });

    recalculateSimulator(uniqueSubs, totalMonthlyOriginal, totalAnnualOriginal);
    renderCurrencyDistribution(uniqueSubs);
}

function recalculateSimulator(uniqueSubs, totalMonthlyOriginal, totalAnnualOriginal) {
    let monthlySaved = 0;
    let annualSaved = 0;

    const checkboxes = document.querySelectorAll('.simulator-checkbox');
    checkboxes.forEach(cb => {
        if (!cb.checked) {
            const subId = cb.dataset.subId;
            const sub = uniqueSubs.find(s => s.subscriptionId === subId);
            if (sub) {
                monthlySaved += getMonthlyCostInGlobal(sub);
                annualSaved += getAnnualCostInGlobal(sub);
            }
        }
    });

    const newAnnualTotal = totalAnnualOriginal - annualSaved;

    document.getElementById('analytics-savings-potential').textContent = formatCurrency(annualSaved, state.globalCurrency);
    document.getElementById('sim-monthly-saved').textContent = formatCurrency(monthlySaved, state.globalCurrency);
    document.getElementById('sim-annual-saved').textContent = formatCurrency(annualSaved, state.globalCurrency);
    document.getElementById('sim-new-annual-total').textContent = formatCurrency(newAnnualTotal, state.globalCurrency);
}

function renderCurrencyDistribution(uniqueSubs) {
    const listEl = document.getElementById('currency-distribution-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (uniqueSubs.length === 0) {
        listEl.innerHTML = '<div style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 24px 0;">Нет данных.</div>';
        return;
    }

    const currencyTotals = { RUB: 0, USD: 0, EUR: 0 };
    let grandTotal = 0;

    uniqueSubs.forEach(sub => {
        const monthlyCostInGlobal = getMonthlyCostInGlobal(sub);
        const curr = sub.currency || 'RUB';
        if (currencyTotals[curr] !== undefined) {
            currencyTotals[curr] += monthlyCostInGlobal;
        } else {
            currencyTotals[curr] = monthlyCostInGlobal;
        }
        grandTotal += monthlyCostInGlobal;
    });

    if (grandTotal === 0) {
        listEl.innerHTML = '<div style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 24px 0;">Нет трат.</div>';
        return;
    }

    const currencies = ['RUB', 'USD', 'EUR'];
    const currencyClasses = { RUB: 'rub', USD: 'usd', EUR: 'eur' };

    currencies.forEach(curr => {
        const costInGlobal = currencyTotals[curr];
        const percent = grandTotal > 0 ? Math.round((costInGlobal / grandTotal) * 100) : 0;
        const costFormatted = formatCurrency(costInGlobal, state.globalCurrency);

        const wrapper = document.createElement('div');
        wrapper.className = 'currency-bar-wrapper';
        wrapper.innerHTML = `
            <div class="currency-bar-header">
                <div class="currency-code-percent">
                    <span class="currency-code ${currencyClasses[curr]}">${curr}</span>
                    <span style="font-size: 12px; color: var(--text-muted); font-weight: 500;">${percent}%</span>
                </div>
                <div class="currency-total-val">${costFormatted} / мес</div>
            </div>
            <div class="currency-bar-outer">
                <div class="currency-bar-fill ${currencyClasses[curr]}" style="width: ${percent}%"></div>
            </div>
        `;
        listEl.appendChild(wrapper);
    });
}

// ==========================================================================
// ICS File Exporter (Standard RFC 5545 format)
// ==========================================================================
function exportToICS() {
    const activeSubs = getUniqueSubscriptions().filter(sub => sub.active);

    if (activeSubs.length === 0) {
        alert('У вас нет активных подписок для экспорта!');
        return;
    }

    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//FinChaos//Subscription Tracker//RU',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
    ];

    const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    activeSubs.forEach(sub => {
        const dateObj = new Date(sub.date);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const dtstart = `${year}${month}${day}`;

        let rrule = '';
        const period = sub.period || 'monthly';
        if (period === 'monthly') {
            rrule = 'RRULE:FREQ=MONTHLY;INTERVAL=1';
        } else if (period === 'quarterly') {
            rrule = 'RRULE:FREQ=MONTHLY;INTERVAL=3';
        } else if (period === 'semi-annually') {
            rrule = 'RRULE:FREQ=MONTHLY;INTERVAL=6';
        } else if (period === 'annually') {
            rrule = 'RRULE:FREQ=YEARLY;INTERVAL=1';
        }

        const escapeText = (text) => {
            if (!text) return '';
            return text
                .replace(/\\/g, '\\\\')
                .replace(/;/g, '\\;')
                .replace(/,/g, '\\,')
                .replace(/\n/g, '\\n');
        };

        const summary = `Оплата ${sub.name}`;
        const descriptionParts = [
            `Стоимость: ${formatCurrency(sub.amount, sub.currency)}`,
            `Категория: ${CATEGORY_MAP[sub.category]}`
        ];
        if (sub.comment) {
            descriptionParts.push(`Комментарий: ${sub.comment}`);
        }
        if (sub.link) {
            descriptionParts.push(`Ссылка: ${sub.link}`);
        }
        const description = descriptionParts.join('\\n');

        icsContent.push('BEGIN:VEVENT');
        icsContent.push(`UID:${sub.subscriptionId || 'sub-' + Date.now()}@finchaos`);
        icsContent.push(`DTSTAMP:${nowStr}`);
        icsContent.push(`DTSTART;VALUE=DATE:${dtstart}`);
        if (rrule) {
            icsContent.push(rrule);
        }
        icsContent.push(`SUMMARY:${escapeText(summary)}`);
        icsContent.push(`DESCRIPTION:${escapeText(description)}`);
        if (sub.link) {
            icsContent.push(`URL:${escapeText(sub.link)}`);
        }
        icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');

    const icsString = icsContent.join('\r\n');

    const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'finchaos_subscriptions.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================================================
// Excel/CSV File Exporter (Russian Excel compatible UTF-8 BOM)
// ==========================================================================
function exportToCSV() {
    const expenses = state.expenses.filter(exp => !exp.deleted);
    if (expenses.length === 0) {
        alert('У вас нет расходов для экспорта!');
        return;
    }

    // CSV Headers
    const headers = ['Название', 'Тип', 'Период', 'Сумма', 'Валюта', 'Категория', 'Дата', 'Ссылка', 'Комментарий', 'Активен', 'Оплачен'];
    
    const rows = expenses.map(exp => [
        exp.name,
        exp.type === 'subscription' ? 'Подписка' : 'Разовый',
        exp.period ? PERIOD_MAP[exp.period] : '',
        exp.amount,
        exp.currency,
        CATEGORY_MAP[exp.category] || exp.category,
        exp.date,
        exp.link || '',
        exp.comment || '',
        exp.active ? 'Да' : 'Нет',
        exp.paid ? 'Да' : 'Нет'
    ]);

    // Format as CSV content
    // Use \ufeff (UTF-8 BOM) so Excel opens Cyrillic characters correctly in UTF-8
    let csvContent = '\uFEFF';
    csvContent += [headers.join(';'), ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `finchaos_export_${getCurrentMonthKey()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================================================
// Category Management Logic
// ==========================================================================
function initCategories() {
    const stored = localStorage.getItem('finchaos_custom_categories');
    let custom = {};
    if (stored) {
        try {
            custom = JSON.parse(stored);
        } catch (e) {
            console.error('Failed to parse custom categories:', e);
        }
    }
    
    state.categories = {
        software: { name: 'Софт / Инструменты', color: 'blue', system: true },
        entertainment: { name: 'Развлечения / Медиа', color: 'red', system: true },
        work: { name: 'Работа / Проекты', color: 'green', system: true },
        utilities: { name: 'Связь и хостинг', color: 'teal', system: true },
        other: { name: 'Другое', color: 'slate', system: true }
    };
    
    Object.keys(custom).forEach(id => {
        state.categories[id] = custom[id];
    });

    // Sync CATEGORY_MAP
    Object.keys(CATEGORY_MAP).forEach(key => {
        if (key !== 'software' && key !== 'entertainment' && key !== 'work' && key !== 'utilities' && key !== 'other') {
            delete CATEGORY_MAP[key];
        }
    });
    Object.keys(state.categories).forEach(id => {
        CATEGORY_MAP[id] = state.categories[id].name;
    });
}
window.initCategories = initCategories;

function getCategoryBadgeClass(categoryId) {
    const cat = state.categories[categoryId];
    if (!cat) return 'badge-other';
    if (cat.system) {
        return `badge-${categoryId}`;
    } else {
        return `badge-${cat.color}`;
    }
}
window.getCategoryBadgeClass = getCategoryBadgeClass;

function getCategoryColorHex(categoryId) {
    const systemColors = {
        software: '#3B82F6',
        entertainment: '#EF4444',
        work: '#10B981',
        utilities: '#84CC16',
        other: '#6B7280'
    };
    if (systemColors[categoryId]) return systemColors[categoryId];

    const presetColors = {
        purple: '#7C3AED',
        pink: '#DB2777',
        orange: '#EA580C',
        teal: '#0D9488',
        indigo: '#4F46E5',
        cyan: '#0891B2'
    };

    const cat = state.categories[categoryId];
    if (cat && presetColors[cat.color]) {
        return presetColors[cat.color];
    }
    return '#6B7280';
}
window.getCategoryColorHex = getCategoryColorHex;

function populateCategoryDropdowns() {
    const categoryFilter = document.getElementById('category-filter');
    const subCategoryFilter = document.getElementById('sub-category-filter');
    const expenseCategory = document.getElementById('expense-category');

    const valFilter = categoryFilter ? categoryFilter.value : 'all';
    const valSubFilter = subCategoryFilter ? subCategoryFilter.value : 'all';
    const valExpCat = expenseCategory ? expenseCategory.value : 'software';

    if (categoryFilter) categoryFilter.innerHTML = '<option value="all">Все категории</option>';
    if (subCategoryFilter) subCategoryFilter.innerHTML = '<option value="all">Все категории</option>';
    if (expenseCategory) expenseCategory.innerHTML = '';

    Object.keys(state.categories).forEach(id => {
        const cat = state.categories[id];
        
        if (categoryFilter) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = cat.name;
            categoryFilter.appendChild(opt);
        }
        
        if (subCategoryFilter) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = cat.name;
            subCategoryFilter.appendChild(opt);
        }
        
        if (expenseCategory) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = cat.name;
            expenseCategory.appendChild(opt);
        }
    });

    if (categoryFilter) categoryFilter.value = state.categories[valFilter] ? valFilter : 'all';
    if (subCategoryFilter) subCategoryFilter.value = state.categories[valSubFilter] ? valSubFilter : 'all';
    if (expenseCategory) expenseCategory.value = state.categories[valExpCat] ? valExpCat : Object.keys(state.categories)[0] || 'other';

    [categoryFilter, subCategoryFilter, expenseCategory].forEach(select => {
        if (select && select.nextElementSibling && select.nextElementSibling.classList.contains('custom-select-container')) {
            select.nextElementSibling.remove();
        }
    });
    initCustomSelects();
}
window.populateCategoryDropdowns = populateCategoryDropdowns;

function renderSettingsCategories() {
    const listEl = document.getElementById('settings-categories-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    
    Object.keys(state.categories).forEach(id => {
        const cat = state.categories[id];
        const item = document.createElement('div');
        item.className = 'category-item';
        item.dataset.id = id;
        
        const badgeClass = cat.system ? `badge-${id}` : `badge-${cat.color}`;
        const nameDisplay = `<span class="badge-category ${badgeClass}">${cat.name}</span>`;
        
        let actionsHtml = '';
        if (cat.system) {
            actionsHtml = `
                <span style="color: var(--text-muted); padding: 6px; display: flex; align-items: center;" title="Системная категория защищена">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </span>
            `;
        } else {
            actionsHtml = `
                <button type="button" class="btn-card-action btn-edit-cat" title="Редактировать" onclick="editCategoryInline('${id}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button type="button" class="btn-card-action btn-delete-cat" title="Удалить" onclick="deleteCategory('${id}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            `;
        }
        
        item.innerHTML = `
            <div class="category-item-info">
                ${nameDisplay}
            </div>
            <div class="category-item-actions">
                ${actionsHtml}
            </div>
        `;
        listEl.appendChild(item);
    });
}
window.renderSettingsCategories = renderSettingsCategories;

function editCategoryInline(id) {
    const itemEl = document.querySelector(`.category-item[data-id="${id}"]`);
    if (!itemEl) return;
    
    const cat = state.categories[id];
    if (!cat || cat.system) return;
    
    const infoEl = itemEl.querySelector('.category-item-info');
    const actionsEl = itemEl.querySelector('.category-item-actions');
    
    const oldInfoHtml = infoEl.innerHTML;
    const oldActionsHtml = actionsEl.innerHTML;
    
    infoEl.innerHTML = `
        <input type="text" class="category-item-name-input" value="${cat.name}">
    `;
    
    actionsEl.innerHTML = `
        <button type="button" class="btn-card-action btn-save-cat-inline" title="Сохранить" style="color: var(--success-text);">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
        <button type="button" class="btn-card-action btn-cancel-cat-inline" title="Отмена" style="color: var(--text-muted);">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
    `;
    
    const input = infoEl.querySelector('.category-item-name-input');
    input.focus();
    input.select();
    
    actionsEl.querySelector('.btn-save-cat-inline').addEventListener('click', () => {
        const newName = input.value.trim();
        if (!newName) {
            alert('Название категории не может быть пустым!');
            return;
        }
        
        state.categories[id].name = newName;
        CATEGORY_MAP[id] = newName;
        
        saveCustomCategoriesToStorage();
        
        renderSettingsCategories();
        populateCategoryDropdowns();
        updateUI();
    });
    
    actionsEl.querySelector('.btn-cancel-cat-inline').addEventListener('click', () => {
        infoEl.innerHTML = oldInfoHtml;
        actionsEl.innerHTML = oldActionsHtml;
    });
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            actionsEl.querySelector('.btn-save-cat-inline').click();
        } else if (e.key === 'Escape') {
            actionsEl.querySelector('.btn-cancel-cat-inline').click();
        }
    });
}
window.editCategoryInline = editCategoryInline;

function addCategory() {
    const input = document.getElementById('new-category-name');
    if (!input) return;
    
    const name = input.value.trim();
    if (!name) {
        alert('Пожалуйста, введите название категории!');
        return;
    }
    
    const nameExists = Object.values(state.categories).some(c => c.name.toLowerCase() === name.toLowerCase());
    if (nameExists) {
        alert('Категория с таким названием уже существует!');
        return;
    }
    
    const selectedColorEl = document.querySelector('.color-preset-circle.selected');
    const color = selectedColorEl ? selectedColorEl.dataset.color : 'purple';
    
    const id = 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    
    state.categories[id] = {
        name: name,
        color: color,
        system: false
    };
    
    CATEGORY_MAP[id] = name;
    
    input.value = '';
    
    saveCustomCategoriesToStorage();
    
    renderSettingsCategories();
    populateCategoryDropdowns();
    updateUI();
}
window.addCategory = addCategory;

function initCategoryColorPicker() {
    const picker = document.getElementById('category-color-picker');
    if (!picker) return;
    
    const circles = picker.querySelectorAll('.color-preset-circle');
    circles.forEach(c => {
        c.addEventListener('click', () => {
            circles.forEach(other => other.classList.remove('selected'));
            c.classList.add('selected');
        });
    });
}
window.initCategoryColorPicker = initCategoryColorPicker;

function deleteCategory(id) {
    const cat = state.categories[id];
    if (!cat || cat.system) return;
    
    if (confirm(`Вы уверены, что хотите удалить категорию "${cat.name}"? Все расходы и подписки из этой категории будут автоматически перенесены в категорию "Другое" (other).`)) {
        
        let modifiedExpenses = false;
        state.expenses.forEach(exp => {
            if (exp.category === id) {
                exp.category = 'other';
                modifiedExpenses = true;
                
                if (state.authMode === 'supabase' && state.currentUser) {
                    supabaseClient.from('expenses').update({ category: 'other' }).eq('id', exp.id)
                        .then(({ error }) => { if (error) console.error('Error updating deleted category in Supabase:', error); });
                }
            }
        });
        
        delete state.categories[id];
        delete CATEGORY_MAP[id];
        
        saveCustomCategoriesToStorage();
        if (modifiedExpenses) {
            saveStateToStorage();
        }
        
        renderSettingsCategories();
        populateCategoryDropdowns();
        updateUI();
    }
}
window.deleteCategory = deleteCategory;

function saveCustomCategoriesToStorage() {
    const custom = {};
    Object.keys(state.categories).forEach(id => {
        if (!state.categories[id].system) {
            custom[id] = state.categories[id];
        }
    });
    localStorage.setItem('finchaos_custom_categories', JSON.stringify(custom));
}
window.saveCustomCategoriesToStorage = saveCustomCategoriesToStorage;

// ==========================================================================
// Lightweight Onboarding Tour Engine
// ==========================================================================
let onboardingCurrentStep = 0;
let onboardingTooltipEl = null;

const ONBOARDING_STEPS = [
    {
        target: '#current-month-display',
        title: 'Выбор месяца',
        text: 'Кликните по названию месяца, чтобы быстро переключиться на нужный месяц и год.'
    },
    {
        target: '#btn-add-expense',
        title: 'Добавление расходов',
        text: 'Создайте вашу первую регулярную подписку или разовый расход здесь.'
    },
    {
        target: '.view-mode-toggle',
        title: 'Режимы дашборда',
        text: 'Переключайтесь между списком карточек и календарем платежей.'
    },
    {
        target: '.budget-card',
        title: 'Управление бюджетом',
        text: 'Установите лимит расходов на месяц, чтобы отслеживать перерасход.'
    },
    {
        target: '#nav-analytics',
        title: 'Аналитика и симулятор',
        text: 'Тут можно рассчитывать годовые расходы и симулировать отключение подписок.'
    }
];

function startOnboardingTour() {
    onboardingCurrentStep = 0;
    showOnboardingStep(0);
}

function closeOnboardingTour() {
    if (onboardingTooltipEl) {
        onboardingTooltipEl.remove();
        onboardingTooltipEl = null;
    }
    localStorage.setItem('finchaos_onboarding_completed', 'true');
}

function showOnboardingStep(stepIdx) {
    if (onboardingTooltipEl) {
        onboardingTooltipEl.remove();
        onboardingTooltipEl = null;
    }

    if (stepIdx >= ONBOARDING_STEPS.length) {
        closeOnboardingTour();
        return;
    }

    onboardingCurrentStep = stepIdx;
    const step = ONBOARDING_STEPS[stepIdx];
    const targetEl = document.querySelector(step.target);

    // If target element is not visible or doesn't exist, skip to next
    if (!targetEl || targetEl.offsetParent === null) {
        showOnboardingStep(stepIdx + 1);
        return;
    }

    // Create tooltip element
    onboardingTooltipEl = document.createElement('div');
    onboardingTooltipEl.className = 'onboarding-tooltip arrow-top';
    
    onboardingTooltipEl.innerHTML = `
        <div class="onboarding-tooltip-header">${step.title}</div>
        <div class="onboarding-tooltip-body">${step.text}</div>
        <div class="onboarding-tooltip-footer">
            <span class="onboarding-step-counter">${stepIdx + 1} из ${ONBOARDING_STEPS.length}</span>
            <div style="display: flex; gap: 8px;">
                <button type="button" class="onboarding-skip-btn" onclick="closeOnboardingTour()">Пропустить</button>
                <button type="button" class="onboarding-tooltip-btn" onclick="nextOnboardingStep()">${stepIdx === ONBOARDING_STEPS.length - 1 ? 'Готово' : 'Далее'}</button>
            </div>
        </div>
    `;

    document.body.appendChild(onboardingTooltipEl);

    // Position tooltip
    const rect = targetEl.getBoundingClientRect();
    const tooltipWidth = onboardingTooltipEl.offsetWidth;

    let top = rect.bottom + window.scrollY + 12;
    let left = rect.left + window.scrollX;

    // Adjust left if offscreen
    if (left + tooltipWidth > window.innerWidth) {
        left = window.innerWidth - tooltipWidth - 16;
    }
    if (left < 16) {
        left = 16;
    }

    onboardingTooltipEl.style.top = top + 'px';
    onboardingTooltipEl.style.left = left + 'px';
}

function nextOnboardingStep() {
    showOnboardingStep(onboardingCurrentStep + 1);
}

// ==========================================================================
// Interactive Stories Playback Engine
// ==========================================================================
const STORIES_DATA = [
    {
        title: "Автоматические курсы валют",
        desc: "Мы интегрировали котировки ЦБ РФ! Теперь курсы валют могут обновляться автоматически в фоновом режиме при каждом входе в FinChaos. Больше не нужно вводить значения вручную — просто включите автообновление в настройках.",
        image: "assets/currency_story.png",
        ctaText: "Включить автообновление"
    },
    {
        title: "Больше удобных выгрузок",
        desc: "В настройки перенесен экспорт ICS для календарей. Добавлена долгожданная выгрузка расходов в CSV (полностью оптимизированная под Microsoft Excel на русском языке с UTF-8 BOM и разделителем «;»). А также резервные копии JSON.",
        image: "assets/data_story.png",
        ctaText: "Открыть экспорт и импорт"
    },
    {
        title: "Облачная синхронизация",
        desc: "FinChaos теперь полноценный облачный сервис на базе Supabase! Ваши расходы, лимиты бюджетов и настройки сохраняются в облаке и доступны с любого устройства. При первой регистрации локальные данные переносятся автоматически.",
        image: "assets/cloud_story.png"
    }
];

let activeStoryIndex = 0;
let storyTimer = null;
let storyProgress = 0;
let storyPaused = false;
const STORY_DURATION = 20000; // 20 seconds per slide
const STORY_TICK = 50; // Update progress every 50ms

function openStory(index) {
    activeStoryIndex = index;
    storyProgress = 0;
    storyPaused = false;
    
    const modal = document.getElementById('story-viewer-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
    
    renderStoryBars();
    loadStoryContent(activeStoryIndex);
    startStoryTimer();
}

function closeStory() {
    stopStoryTimer();
    const modal = document.getElementById('story-viewer-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

function renderStoryBars() {
    const container = document.getElementById('story-progress-bars');
    if (!container) return;
    
    container.innerHTML = '';
    STORIES_DATA.forEach((_, idx) => {
        const segment = document.createElement('div');
        segment.className = 'story-progress-segment';
        
        const fill = document.createElement('div');
        fill.className = 'story-progress-fill';
        fill.id = `story-progress-fill-${idx}`;
        
        if (idx < activeStoryIndex) {
            fill.style.width = '100%';
        } else {
            fill.style.width = '0%';
        }
        
        segment.appendChild(fill);
        container.appendChild(segment);
    });
}

function loadStoryContent(index) {
    const story = STORIES_DATA[index];
    if (!story) return;
    
    const titleEl = document.getElementById('story-viewer-title');
    const descEl = document.getElementById('story-viewer-desc');
    const imgContainer = document.getElementById('story-viewer-image');
    
    if (titleEl) titleEl.textContent = story.title;
    if (descEl) descEl.textContent = story.desc;
    if (imgContainer) {
        imgContainer.style.backgroundImage = `url('${story.image}')`;
    }
    
    const ctaBtn = document.getElementById('story-viewer-cta');
    if (ctaBtn) {
        if (story.ctaText) {
            ctaBtn.textContent = story.ctaText;
            ctaBtn.style.display = 'flex';
        } else {
            ctaBtn.style.display = 'none';
        }
    }
    
    updatePauseButtonState(false);
}

function startStoryTimer() {
    stopStoryTimer();
    storyTimer = setInterval(() => {
        if (!storyPaused) {
            storyProgress += (STORY_TICK / STORY_DURATION) * 100;
            if (storyProgress >= 100) {
                storyProgress = 100;
                updateProgressBar(activeStoryIndex, 100);
                nextStory();
            } else {
                updateProgressBar(activeStoryIndex, storyProgress);
            }
        }
    }, STORY_TICK);
}

function stopStoryTimer() {
    if (storyTimer) {
        clearInterval(storyTimer);
        storyTimer = null;
    }
}

function updateProgressBar(idx, pct) {
    const fill = document.getElementById(`story-progress-fill-${idx}`);
    if (fill) {
        fill.style.width = `${pct}%`;
    }
}

function nextStory() {
    if (activeStoryIndex < STORIES_DATA.length - 1) {
        updateProgressBar(activeStoryIndex, 100);
        activeStoryIndex++;
        storyProgress = 0;
        loadStoryContent(activeStoryIndex);
        renderStoryBars();
    } else {
        closeStory();
    }
}

function prevStory() {
    if (storyProgress > 15 || activeStoryIndex === 0) {
        storyProgress = 0;
        updateProgressBar(activeStoryIndex, 0);
    } else {
        activeStoryIndex--;
        storyProgress = 0;
        loadStoryContent(activeStoryIndex);
        renderStoryBars();
    }
}

function toggleStoryPause() {
    storyPaused = !storyPaused;
    updatePauseButtonState(storyPaused);
}

function updatePauseButtonState(paused) {
    const pauseBtn = document.getElementById('story-pause-btn');
    if (!pauseBtn) return;
    
    if (paused) {
        pauseBtn.innerHTML = `
            <svg id="story-pause-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 14px; height: 14px; color: white;">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
        `;
    } else {
        pauseBtn.innerHTML = `
            <svg id="story-pause-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 14px; height: 14px; color: white;">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
        `;
    }
}

function setupStoriesHoldListeners() {
    const storyCardBody = document.getElementById('story-viewer-card-body');
    if (storyCardBody) {
        storyCardBody.addEventListener('mousedown', () => {
            storyPaused = true;
            updatePauseButtonState(true);
        });
        storyCardBody.addEventListener('touchstart', (e) => {
            storyPaused = true;
            updatePauseButtonState(true);
        }, { passive: true });
        
        const resumeAction = () => {
            if (storyPaused) {
                storyPaused = false;
                updatePauseButtonState(false);
            }
        };
        
        storyCardBody.addEventListener('mouseup', resumeAction);
        storyCardBody.addEventListener('mouseleave', resumeAction);
        storyCardBody.addEventListener('touchend', resumeAction);
        storyCardBody.addEventListener('touchcancel', resumeAction);
    }
}

function handleStoryCTA() {
    closeStory();
    if (activeStoryIndex === 0 || activeStoryIndex === 1) {
        openSettingsModal();
    } else if (activeStoryIndex === 2) {
        if (state.authMode === 'demo') {
            state.authMode = 'ask';
            localStorage.setItem('finchaos_auth_mode', 'ask');
            initAuthUI();
        } else {
            openSettingsModal();
        }
    }
}

// Bind to window for global click handlers
window.closeOnboardingTour = closeOnboardingTour;
window.nextOnboardingStep = nextOnboardingStep;
window.startOnboardingTour = startOnboardingTour;

window.openStory = openStory;
window.closeStory = closeStory;
window.nextStory = nextStory;
window.prevStory = prevStory;
window.toggleStoryPause = toggleStoryPause;
window.setupStoriesHoldListeners = setupStoriesHoldListeners;
window.handleStoryCTA = handleStoryCTA;

function initCustomSelects() {
    const selects = document.querySelectorAll('.select-styled');
    
    selects.forEach(select => {
        if (select.nextElementSibling && select.nextElementSibling.classList.contains('custom-select-container')) {
            return;
        }
        
        const container = document.createElement('div');
        container.className = 'custom-select-container';
        if (select.classList.contains('w-100')) {
            container.classList.add('w-100');
        }
        
        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        trigger.setAttribute('tabindex', '0');
        
        const triggerText = document.createElement('span');
        triggerText.className = 'custom-select-trigger-text';
        
        const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        chevron.setAttribute('class', 'custom-select-chevron');
        chevron.setAttribute('viewBox', '0 0 24 24');
        chevron.setAttribute('fill', 'none');
        chevron.setAttribute('stroke', 'currentColor');
        chevron.setAttribute('stroke-width', '2');
        chevron.setAttribute('stroke-linecap', 'round');
        chevron.setAttribute('stroke-linejoin', 'round');
        chevron.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';
        
        trigger.appendChild(triggerText);
        trigger.appendChild(chevron);
        container.appendChild(trigger);
        
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'custom-select-options';
        container.appendChild(optionsContainer);
        
        select.parentNode.insertBefore(container, select.nextSibling);
        
        function renderOptions() {
            optionsContainer.innerHTML = '';
            Array.from(select.options).forEach(opt => {
                const optDiv = document.createElement('div');
                optDiv.className = 'custom-select-option';
                optDiv.setAttribute('data-value', opt.value);
                optDiv.textContent = opt.textContent;
                
                if (opt.value === select.value) {
                    optDiv.classList.add('selected');
                    triggerText.textContent = opt.textContent;
                }
                
                optDiv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    select.value = opt.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    closeAllDropdowns();
                });
                
                optionsContainer.appendChild(optDiv);
            });
        }
        
        renderOptions();
        
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = container.classList.contains('open');
            closeAllDropdowns();
            if (!isOpen) {
                container.classList.add('open');
            }
        });
        
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                trigger.click();
            }
        });
        
        const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
        if (originalDescriptor && !select.hasOwnProperty('value')) {
            Object.defineProperty(select, 'value', {
                get() {
                    return originalDescriptor.get.call(this);
                },
                set(newValue) {
                    originalDescriptor.set.call(this, newValue);
                    const option = Array.from(this.options).find(o => o.value === newValue);
                    if (option) {
                        triggerText.textContent = option.textContent;
                        Array.from(optionsContainer.children).forEach(child => {
                            if (child.getAttribute('data-value') === newValue) {
                                child.classList.add('selected');
                            } else {
                                child.classList.remove('selected');
                            }
                        });
                    }
                }
            });
        }

        const form = select.form;
        if (form) {
            form.addEventListener('reset', () => {
                setTimeout(() => {
                    const newValue = select.value;
                    const option = Array.from(select.options).find(o => o.value === newValue);
                    if (option) {
                        triggerText.textContent = option.textContent;
                        Array.from(optionsContainer.children).forEach(child => {
                            if (child.getAttribute('data-value') === newValue) {
                                child.classList.add('selected');
                            } else {
                                child.classList.remove('selected');
                            }
                        });
                    }
                }, 0);
            });
        }
    });
}

function closeAllDropdowns() {
    document.querySelectorAll('.custom-select-container').forEach(c => {
        c.classList.remove('open');
    });
}

document.addEventListener('click', () => {
    closeAllDropdowns();
});

window.initCustomSelects = initCustomSelects;
window.closeAllDropdowns = closeAllDropdowns;

