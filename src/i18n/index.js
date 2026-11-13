import { useSyncExternalStore } from 'react';
import messages from './messages.json';

const listeners = new Set();
const savedLanguage = typeof localStorage === 'undefined' ? null : localStorage.getItem('domus-language');
let language = savedLanguage === 'en' ? 'en' : 'de';
const templates = Object.entries(messages).filter(([key]) => /\{\w+\}/.test(key)).map(([key, translations]) => {
    const fields = [];
    const pattern = key.split(/(\{\w+\})/).map(part => {
        if (/^\{\w+\}$/.test(part)) {
            fields.push(part.slice(1, -1));
            return '(.*?)';
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    return { pattern: new RegExp(`^${pattern}$`), fields, translations };
});

export const getLanguage = () => language;
export const getLocale = () => language === 'en' ? 'en-GB' : 'de-DE';

function notifyLanguageChange() {
    document.documentElement.lang = language;
    for (const listener of listeners) listener();
}

export function setLanguage(next) {
    if (!['de', 'en'].includes(next) || next === language) return;
    language = next;
    localStorage.setItem('domus-language', language);
    notifyLanguageChange();
}

export function translate(text, values = {}, targetLanguage = language) {
    if (typeof text !== 'string') return text;
    let result = messages[text]?.[targetLanguage];
    if (!result) {
        for (const template of templates) {
            const match = template.pattern.exec(text);
            if (!match) continue;
            const extracted = Object.fromEntries(template.fields.map((field, index) => [field, match[index + 1]]));
            if (extracted.label) extracted.label = messages[extracted.label]?.[targetLanguage] || extracted.label;
            if (extracted.end) extracted.end = messages[extracted.end]?.[targetLanguage] || extracted.end;
            values = { ...extracted, ...values };
            result = template.translations[targetLanguage];
            break;
        }
    }
    result ||= text;
    return result.replace(/\{(\w+)\}/g, (placeholder, key) => Object.hasOwn(values, key) ? String(values[key]) : placeholder);
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useTranslation() {
    const currentLanguage = useSyncExternalStore(subscribe, getLanguage);
    return { language: currentLanguage, setLanguage, t: translate, locale: getLocale() };
}

if (typeof document !== 'undefined') document.documentElement.lang = language;
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
    if (event.key !== 'domus-language') return;
    language = event.newValue === 'en' ? 'en' : 'de';
    notifyLanguageChange();
});
