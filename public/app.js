import { EMAILJS_CONFIG } from './config.js';

const form = document.querySelector('#contact-form');
const submitButton = document.querySelector('#submit-button');
const submitLabel = document.querySelector('#submit-label');
const status = document.querySelector('#form-status');
const counter = document.querySelector('#character-count');
const nameInput = form.elements.namedItem('user_name');
const emailInput = form.elements.namedItem('user_email');
const messageInput = form.elements.namedItem('message');
const fields = [nameInput, emailInput, messageInput];
const errorElements = new Map([
  [nameInput, document.querySelector('#name-error')],
  [emailInput, document.querySelector('#email-error')],
  [messageInput, document.querySelector('#message-error')],
]);

let sending = false;
let lastSentAt = 0;
const rateLimitEntries = new Map();
const rateLimitStorage = {
  get: async (key) => rateLimitEntries.get(key),
  set: async (key, value) => { rateLimitEntries.set(key, value); },
  remove: async (key) => { rateLimitEntries.delete(key); },
};

function showStatus(text, kind = 'error') {
  status.dataset.kind = kind;
  status.textContent = text;
  status.hidden = false;
}

function clearStatus() {
  status.hidden = true;
  status.textContent = '';
}

function validateField(field) {
  let error = '';
  if (!field.value.trim()) {
    if (field === nameInput) error = 'Укажите, как к вам обращаться.';
    if (field === emailInput) error = 'Укажите электронную почту для ответа.';
    if (field === messageInput) error = 'Напишите ваше сообщение.';
  } else if (field === emailInput && field.validity.typeMismatch) {
    error = 'Проверьте адрес, например name@example.com.';
  } else if (field.value.length > field.maxLength) {
    error = `Не более ${field.maxLength} символов.`;
  }

  errorElements.get(field).textContent = error;
  if (error) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
  return !error;
}

function updateCounter() {
  counter.textContent = `${messageInput.value.length} / ${messageInput.maxLength}`;
}

function setSending(value) {
  sending = value;
  submitButton.disabled = value;
  submitButton.classList.toggle('is-loading', value);
  submitLabel.textContent = value ? 'Отправляем…' : 'Отправить сообщение';
  form.setAttribute('aria-busy', String(value));
  // Поля остаются в FormData, но их нельзя менять во время отправки.
  for (const field of fields) field.readOnly = value;
}

function isConfigured() {
  return ['publicKey', 'serviceId', 'templateId'].every((key) => {
    const value = EMAILJS_CONFIG[key];
    return typeof value === 'string' && value.trim() && !/ВАШ_|YOUR_/i.test(value);
  });
}

function deliveryError(error) {
  if (navigator.onLine === false) return 'Нет подключения к интернету. Проверьте соединение и попробуйте ещё раз. Текст остался в форме.';
  if (Number(error?.status) === 429) return 'Сейчас отправляется слишком много сообщений. Подождите немного и попробуйте ещё раз. Текст остался в форме.';
  return 'Не удалось отправить сообщение. Попробуйте ещё раз немного позже. Текст остался в форме.';
}

for (const field of fields) {
  field.addEventListener('blur', () => {
    // Не показываем ошибки у полей, до которых пользователь ещё не дошёл.
    if (field.value || field.hasAttribute('aria-invalid')) validateField(field);
  });
  field.addEventListener('input', () => {
    clearStatus();
    if (field.hasAttribute('aria-invalid')) validateField(field);
    if (field === messageInput) updateCounter();
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (sending) return;
  clearStatus();

  // Дополнительная ловушка для простых ботов; не заменяет защиту EmailJS.
  if (form.elements.namedItem('website').value) {
    showStatus('Не удалось отправить сообщение. Обновите страницу и попробуйте снова.');
    return;
  }

  for (const field of fields) field.value = field.value.trim();
  updateCounter();
  const valid = fields.map(validateField).every(Boolean);
  if (!valid) {
    showStatus('Проверьте отмеченные поля.');
    fields.find((field) => field.hasAttribute('aria-invalid')).focus();
    return;
  }

  if (!isConfigured()) {
    showStatus('Форма пока не подключена к почте. Отправка временно недоступна. Ваше сообщение не отправлено.');
    return;
  }

  if (navigator.onLine === false) {
    showStatus(deliveryError());
    return;
  }

  if (!window.emailjs?.sendForm) {
    showStatus('Не удалось загрузить сервис отправки. Обновите страницу и попробуйте ещё раз. Текст остался в форме.');
    return;
  }

  if (lastSentAt && Date.now() - lastSentAt < 10_000) {
    showStatus('Сообщение уже отправлено. Подождите несколько секунд перед следующим.');
    return;
  }

  setSending(true);
  try {
    window.emailjs.init({
      publicKey: EMAILJS_CONFIG.publicKey.trim(),
      limitRate: { id: 'contact-form', throttle: 10_000 },
      storageProvider: rateLimitStorage,
    });
    await window.emailjs.sendForm(
      EMAILJS_CONFIG.serviceId.trim(),
      EMAILJS_CONFIG.templateId.trim(),
      form,
    );
    lastSentAt = Date.now();
    form.reset();
    updateCounter();
    for (const field of fields) {
      field.removeAttribute('aria-invalid');
      errorElements.get(field).textContent = '';
    }
    showStatus('Сообщение отправлено! Спасибо, что написали. Если понадобится ответ, мы свяжемся с вами по указанной почте.', 'success');
  } catch (error) {
    showStatus(deliveryError(error));
  } finally {
    setSending(false);
  }
});

const privacyDialog = document.querySelector('#privacy-dialog');
document.querySelector('#privacy-button').addEventListener('click', () => privacyDialog.showModal());
document.querySelector('#close-privacy').addEventListener('click', () => privacyDialog.close());
privacyDialog.addEventListener('click', (event) => {
  if (event.target !== privacyDialog) return;
  const rect = privacyDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) privacyDialog.close();
});

updateCounter();
submitButton.disabled = false;
