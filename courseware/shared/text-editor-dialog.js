(function (window, document) {
  'use strict';

  var dialog;
  var active;

  function makeElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'msv-text-editor-dialog';
    dialog.setAttribute('aria-labelledby', 'msv-text-editor-title');
    dialog.addEventListener('click', function (event) { event.stopPropagation(); });
    dialog.addEventListener('keydown', function (event) {
      event.stopPropagation();
    });

    var form = makeElement('form', 'msv-text-editor-form');
    form.setAttribute('method', 'dialog');
    var title = makeElement('h2', 'msv-text-editor-title', '编辑课件文字');
    title.id = 'msv-text-editor-title';
    var help = makeElement('p', 'msv-text-editor-help', '保存后供以后使用，并同步当前投屏；其他播放场次不会自动切换。');
    var limitation = makeElement('p', 'msv-text-editor-limitation', '只能编辑文字，不修改页面结构或互动规则。');
    var label = makeElement('label', 'msv-text-editor-label');
    var labelText = makeElement('span', 'msv-text-editor-label-text');
    var textarea = document.createElement('textarea');
    textarea.className = 'msv-text-editor-textarea';
    textarea.maxLength = 2000;
    textarea.rows = 10;
    textarea.setAttribute('aria-describedby', 'msv-text-editor-count msv-text-editor-error');
    label.appendChild(labelText);
    label.appendChild(textarea);
    var meta = makeElement('div', 'msv-text-editor-meta');
    var count = makeElement('span', 'msv-text-editor-count');
    count.id = 'msv-text-editor-count';
    var error = makeElement('p', 'msv-text-editor-error');
    error.id = 'msv-text-editor-error';
    error.setAttribute('role', 'alert');
    error.hidden = true;
    meta.appendChild(count);
    var actions = makeElement('div', 'msv-text-editor-actions');
    var preview = makeElement('button', 'msv-text-editor-button msv-text-editor-button-preview', '预览修改');
    preview.type = 'button';
    var restore = makeElement('button', 'msv-text-editor-button msv-text-editor-button-restore', '恢复原文');
    restore.type = 'button';
    var cancel = makeElement('button', 'msv-text-editor-button msv-text-editor-button-cancel', '取消');
    cancel.type = 'button';
    var save = makeElement('button', 'msv-text-editor-button msv-text-editor-button-save', '保存为新版');
    save.type = 'submit';
    actions.appendChild(preview); actions.appendChild(restore); actions.appendChild(cancel); actions.appendChild(save);
    form.appendChild(title); form.appendChild(help); form.appendChild(limitation); form.appendChild(label);
    form.appendChild(meta); form.appendChild(error); form.appendChild(actions);
    dialog.appendChild(form);
    document.body.appendChild(dialog);
    dialog._parts = { form: form, label: labelText, textarea: textarea, count: count, error: error, preview: preview, restore: restore, cancel: cancel, save: save };
    textarea.addEventListener('input', updateCount);
    preview.addEventListener('click', function () { if (active && !active.busy) active.onPreview(textarea.value); });
    restore.addEventListener('click', function () {
      if (!active || active.busy) return;
      textarea.value = active.originalValue.slice(0, 2000);
      updateCount();
      active.onPreview(textarea.value);
    });
    cancel.addEventListener('click', function () { closeAsCancelled(); });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      saveValue();
    });
    dialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeAsCancelled();
    });
    return dialog;
  }

  function updateCount() {
    if (!dialog || !dialog._parts) return;
    var length = dialog._parts.textarea.value.length;
    dialog._parts.count.textContent = length + ' / 2000 字';
  }

  function closeAsCancelled() {
    if (!active || active.busy) return;
    var current = active;
    active = null;
    dialog.close();
    if (typeof current.onClose === 'function') current.onClose();
    if (current.focus && typeof current.focus.focus === 'function') current.focus.focus();
  }

  async function saveValue() {
    if (!active || active.busy) return;
    var parts = dialog._parts;
    var current = active;
    current.busy = true;
    parts.textarea.disabled = true;
    parts.save.disabled = parts.preview.disabled = parts.restore.disabled = parts.cancel.disabled = true;
    parts.error.hidden = true;
    try {
      await current.onSave(parts.textarea.value);
      active = null;
      dialog.close();
      if (current.focus && typeof current.focus.focus === 'function') current.focus.focus();
    } catch (error) {
      parts.error.textContent = error && error.message ? error.message : '保存失败，请稍后重试。';
      parts.error.hidden = false;
      current.busy = false;
      parts.textarea.disabled = false;
      parts.save.disabled = parts.preview.disabled = parts.restore.disabled = parts.cancel.disabled = false;
      parts.textarea.focus();
    }
  }

  window.MSVTextEditorDialog = {
    open: function (options) {
      options = options || {};
      var instance = ensureDialog();
      var parts = instance._parts;
      if (instance.open && active && active.busy) return;
      if (instance.open && active) closeAsCancelled();
      active = {
        onSave: typeof options.onSave === 'function' ? options.onSave : function () {},
        onPreview: typeof options.onPreview === 'function' ? options.onPreview : function () {},
        onClose: typeof options.onClose === 'function' ? options.onClose : function () {},
        originalValue: String(options.originalValue == null ? '' : options.originalValue),
        focus: document.activeElement,
        busy: false
      };
      parts.textarea.disabled = false;
      parts.label.textContent = String(options.label == null ? '课件文字' : options.label);
      parts.textarea.value = String(options.value == null ? '' : options.value).slice(0, 2000);
      parts.error.textContent = '';
      parts.error.hidden = true;
      parts.save.disabled = parts.preview.disabled = parts.restore.disabled = parts.cancel.disabled = false;
      updateCount();
      instance.showModal();
      window.setTimeout(function () { if (active) parts.textarea.focus(); }, 0);
    }
  };
})(window, document);
