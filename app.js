(() => {
  'use strict';

  // Informe o número da loja com código do país e DDD, usando apenas dígitos.
  const STORE_WHATSAPP = '5551997259201';
  const DELIVERY_FEE_CENTS = 900;
  const STORAGE_KEY = 'acai-dos-deuses-cart-v1';
  const MAX_QUANTITY = 99;
  const FREE_TOPPING_LIMITS = { 300: 3, 400: 4, 500: 5 };
  const PAID_TOPPING_LIMIT = 2;
  const TOPPING_PRICING_RULE = 'separate-extras-v1';
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const categories = {
    mix: { title: 'Copo com adicionais', prices: { 300: 1200, 400: 1500, 500: 1800 } },
    pure: { title: 'Açaí puro', prices: { 300: 1400, 400: 1800, 500: 2000 } },
  };
  const toppings = [
    { id: 'condensado', name: 'Leite condensado', price: 0 },
    { id: 'leite-em-po', name: 'Leite Ninho em pó', price: 0 },
    { id: 'granola', name: 'Granola', price: 0 },
    { id: 'pacoca', name: 'Paçoca', price: 0 },
    { id: 'banana', name: 'Banana', price: 0 },
    { id: 'morango', name: 'Morango', price: 300 },
    { id: 'bis', name: 'Bis', price: 200 },
    { id: 'mousse', name: 'Mousse', price: 300 },
    { id: 'leitinho', name: 'Creme Leitinho', price: 400 },
    { id: 'avela', name: 'Creme de avelã', price: 350 },
    { id: 'ovomaltine', name: 'Ovomaltine', price: 300 },
    { id: 'amendoim', name: 'Amendoim triturado', price: 200 },
  ];
  const toppingIcons = ['🥛', '🥄', '🌾', '🥜', '🍌', '🍓', '🍫', '🍮', '🥄', '🌰', '🍫', '🥜'];
  const toppingLayerColors = ['#f5e0ac', '#f0d9bc', '#c88431', '#bd874d', '#f3ce60', '#e74d67',
    '#57292a', '#ad735d', '#fff1cc', '#843d26', '#9b5e36', '#dfaa5e'];
  const formatTitles = { cup: 'Copo de açaí', bottle: 'Garrafa de açaí', boat: 'Barca de açaí' };
  const toppingsById = new Map(toppings.map((topping) => [topping.id, topping]));
  const paidToppings = toppings.filter((topping) => topping.price > 0);

  const productContent = document.querySelector('#product-content');
  const cartDialog = document.querySelector('#cart-dialog');
  const cartContent = document.querySelector('#cart-content');
  const cartCount = document.querySelectorAll('[data-cart-count]');
  const cartButtons = document.querySelectorAll('[data-open-cart]');
  const floatingCart = document.querySelector('[data-floating-cart]');
  let cartOpener;
  const siteStatus = document.querySelector('#site-status');
  const formatButtons = [...document.querySelectorAll('[data-format]')];
  const variantButtons = [...document.querySelectorAll('[data-product]')];
  const cupVariants = document.querySelector('.builder-variants');
  const stage = document.querySelector('.builder-stage');
  const stageTitle = document.querySelector('[data-stage-title]');
  const stageToppings = document.querySelector('[data-stage-toppings]');
  const ingredientLayer = document.querySelector('[data-stage-ingredients]');
  const ingredientSheet = document.querySelector('[data-ingredient-sheet]');
  const textureSheet = document.querySelector('[data-texture-sheet]');
  const cupGarnish = document.querySelector('[data-cup-garnish]');
  const cupPowder = document.querySelector('[data-cup-powder]');
  const stagePhotos = document.querySelectorAll('[data-format-photo]');
  const placedToppings = new Map();
  let cupVariant = 'mix-300';
  let cart = loadCart();
  const checkoutDraft = {
    customerName: '',
    fulfillment: '',
    street: '',
    streetNumber: '',
    neighborhood: '',
    notes: '',
  };
  let statusTimer;
  let clearStatusTimer;

  function formatPrice(cents) {
    return currency.format(cents / 100);
  }

  function loadCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (!Array.isArray(saved)) return [];

      return saved.flatMap((item) => {
        if (!item || !Object.hasOwn(categories, item.category)) return [];
        if (!Object.hasOwn(categories[item.category].prices, item.size)) return [];
        if (!Number.isInteger(item.quantity) || item.quantity < 1) return [];

        const selected = item.category === 'mix' && Array.isArray(item.toppings)
          ? item.toppings.filter((id) => toppingsById.has(id))
          : [];
        const extras = item.category === 'mix' && Array.isArray(item.extras)
          ? paidToppings.flatMap(({ id }) => {
            const savedExtra = item.extras.find((extra) => extra?.id === id
              && Number.isInteger(extra.quantity) && extra.quantity > 0);
            return savedExtra ? [{ id, quantity: Math.min(savedExtra.quantity, MAX_QUANTITY) }] : [];
          })
          : [];
        // Sem a identificação da regra, uma escolha paga pode ter sido incluída na
        // cota de uma versão anterior. Preserve o item, mas peça para remontá-lo.
        const pricingRule = item.pricingRule === TOPPING_PRICING_RULE
          || extras.length || !selected.some((id) => toppingsById.get(id).price > 0)
          ? TOPPING_PRICING_RULE : 'review';

        return [{
          category: item.category,
          size: Number(item.size),
          toppings: selected,
          ...(item.category === 'mix' ? { pricingRule } : {}),
          ...(extras.length ? { extras } : {}),
          quantity: Math.min(item.quantity, MAX_QUANTITY),
        }];
      });
    } catch {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // O pedido continua disponível na página se o navegador bloquear o armazenamento.
    }
    updateCartCount();
  }

  function updateCartCount() {
    const total = cart.reduce((count, item) => count + item.quantity, 0);
    floatingCart.hidden = total === 0;
    cartCount.forEach((element) => { element.textContent = total; });
    cartButtons.forEach((button) => {
      button.setAttribute('aria-label', `Abrir sacola, ${total} ${total === 1 ? 'item' : 'itens'}`);
    });
  }

  function announce(message) {
    clearTimeout(statusTimer);
    clearTimeout(clearStatusTimer);
    siteStatus.textContent = '';
    statusTimer = setTimeout(() => { siteStatus.textContent = message; }, 30);
    clearStatusTimer = setTimeout(() => { siteStatus.textContent = ''; }, 3400);
  }

  function itemToppings(item) {
    return item.toppings.map((id) => toppingsById.get(id));
  }

  function itemExtras(item) {
    return (item.extras ?? []).map(({ id, quantity }) => ({
      ...toppingsById.get(id),
      quantity,
    }));
  }

  function extraToppingsTotal(item) {
    return itemExtras(item).reduce((total, { price, quantity }) => total + price * quantity, 0);
  }

  function describeExtras(item) {
    return itemExtras(item)
      .map(({ name, price, quantity }) => `${quantity} × ${name} (+ ${formatPrice(price * quantity)})`)
      .join(', ');
  }

  function toppingSelection(item) {
    const selected = itemToppings(item);
    const freeCount = selected.filter((topping) => topping.price === 0).length;

    return {
      free: { count: freeCount, limit: FREE_TOPPING_LIMITS[item.size] },
      paid: { count: selected.length - freeCount, limit: PAID_TOPPING_LIMIT },
    };
  }

  function toppingIssue({ free, paid }) {
    if (free.count && paid.count) return 'mixed';
    if (free.count > free.limit || paid.count > paid.limit) return 'limit';
    return '';
  }

  function cartToppingIssue(item) {
    if (item.category !== 'mix') return '';
    if (new Set(item.toppings).size < item.toppings.length) return 'repeated';
    return toppingIssue(toppingSelection(item)) || (item.pricingRule === 'review' ? 'price' : '');
  }

  function lineTotal(item) {
    const basePrice = categories[item.category].prices[item.size];
    const selected = itemToppings(item);
    const charged = item.pricingRule === 'review' ? selected.slice(FREE_TOPPING_LIMITS[item.size]) : selected;
    const selectedToppingPrice = charged.reduce((total, topping) => total + topping.price, 0);
    return (basePrice + selectedToppingPrice + extraToppingsTotal(item)) * item.quantity;
  }

  function dialogHeader(id, title, description) {
    return `
      <header class="dialog-header">
        <h2 class="dialog-title" id="${id}">${title}</h2>
        ${description ? `<p class="dialog-description">${description}</p>` : ''}
        <button class="dialog-close" type="button" data-close-dialog aria-label="Fechar">×</button>
      </header>`;
  }

  function quantityStepper(quantity, name, index = null) {
    const context = index === null ? '' : `data-cart-index="${index}"`;

    return `
      <div class="quantity-stepper" role="group" aria-label="Quantidade de ${name}">
        <button type="button" ${context} data-quantity-change="-1" aria-label="Diminuir quantidade de ${name}" ${quantity <= 1 ? 'disabled' : ''}>−</button>
        <output aria-label="Quantidade" data-quantity>${quantity}</output>
        <button type="button" ${context} data-quantity-change="1" aria-label="Aumentar quantidade de ${name}" ${quantity >= MAX_QUANTITY ? 'disabled' : ''}>+</button>
      </div>`;
  }

  function toppingOptions(paid) {
    const options = paid ? paidToppings : toppings.filter((topping) => topping.price === 0);
    return `
      <fieldset class="dialog-section" data-topping-group="${paid ? 'paid' : 'free'}">
        <legend>${paid ? 'Adicionais pagos' : 'Adicionais grátis'} <span class="topping-counter" data-topping-counter></span></legend>
        <div class="builder-toppings">
          ${options.map((topping) => toppingTile(topping, paid ? `+ ${formatPrice(topping.price)}` : '')).join('')}
        </div>
      </fieldset>`;
  }

  function toppingTile(topping, price = '') {
    const icon = toppingIcons[toppings.indexOf(topping)];
    return `
      <label class="builder-topping">
        <input type="checkbox" name="topping" value="${topping.id}">
        <span class="builder-topping-icon" aria-hidden="true">${icon}</span>
        <span class="builder-topping-name">${topping.name}</span>
        ${price ? `<span class="builder-topping-price">${price}</span>` : ''}
      </label>`;
  }

  function previewToppings(selectedIds, lastToppingId) {
    const selected = new Set(selectedIds);
    const layered = stage.dataset.stageFormat !== 'boat';
    for (const [id, image] of placedToppings) {
      if (selected.has(id)) continue;
      image.remove();
      placedToppings.delete(id);
    }
    for (const id of selected) {
      if (placedToppings.has(id)) continue;
      const index = toppings.indexOf(toppingsById.get(id));
      const image = document.createElement('span');
      image.className = 'builder-ingredient';
      image.style.setProperty('--layer-color', toppingLayerColors[index]);
      image.style.setProperty('--layer-texture-position', `${(index % 4) * 100 / 3}% ${Math.floor(index / 4) * 100 / 3}%`);
      if (layered) {
        image.innerHTML = '<span class="builder-layer-fill"></span><span class="builder-layer-fill builder-layer-topping"></span>';
      }
      ingredientLayer.append(image);
      placedToppings.set(id, image);
    }
    ingredientLayer.style.setProperty('--layer-count', Math.max(1, selected.size));
    const customCup = stage.dataset.stagePhoto === 'cup';
    const isPowder = lastToppingId === 'leite-em-po';
    cupPowder.hidden = !customCup || !isPowder;
    cupGarnish.hidden = !customCup || !lastToppingId || isPowder;
    if (!cupGarnish.hidden) {
      const last = toppings.indexOf(toppingsById.get(lastToppingId));
      cupGarnish.style.setProperty('--garnish-position', `${(last % 4) * 100 / 3}% ${Math.floor(last / 4) * 50}%`);
    }
    const names = [...placedToppings.keys()].flatMap((id) => {
      const name = toppingsById.get(id).name;
      return layered ? ['Açaí', name] : [name];
    }).join(' · ');
    stageToppings.textContent = layered && selected.size ? `De baixo para cima: ${names}` : names;
    stageToppings.hidden = selected.size === 0;
  }

  function paidExtraOptions() {
    return `
      <details class="paid-extras">
        <summary>Extras pagos</summary>
        <fieldset class="dialog-section" aria-label="Porções extras pagas">
          <p class="paid-extras-note">Escolha quantas porções extras quer em cada copo. O preço é por porção.</p>
          <div class="paid-extra-list">
            ${paidToppings.map(({ id, name, price }) => `
              <label class="paid-extra-row">
                <span>${name}</span>
                <span class="paid-extra-price">+ ${formatPrice(price)}</span>
                <input class="paid-extra-quantity" type="number" min="0" max="${MAX_QUANTITY}" step="1" value="0" inputmode="numeric" data-extra-topping="${id}" aria-label="Porções extras de ${name} por copo">
              </label>`).join('')}
          </div>
          <p class="paid-extras-subtotal">Extras por copo <strong data-paid-extra-total>${formatPrice(0)}</strong></p>
        </fieldset>
      </details>`;
  }

  function openProduct(key) {
    const [category, initialSize] = key.split('-');
    const product = categories[category];
    if (!product || !Object.hasOwn(product.prices, initialSize)) return;
    let quantity = 1;

    productContent.innerHTML = `
      <h2 class="builder-product-title" id="product-title">${product.title}</h2>
      <form id="product-form">
        <div class="dialog-body">
          <fieldset class="dialog-section">
            <legend>Tamanho</legend>
            <div class="dialog-options dialog-options-sizes">
              ${Object.entries(product.prices).map(([size, price]) => `
                <label class="dialog-choice">
                  <input type="radio" name="size" value="${size}" ${size === initialSize ? 'checked' : ''} required>
                  <span>${size} ml</span>
                  <span class="dialog-choice-price">${formatPrice(price)}</span>
                </label>`).join('')}
            </div>
          </fieldset>
          ${category === 'mix' ? `
            <p class="topping-limit-message" data-topping-limit-message role="status" aria-live="polite" aria-atomic="true"></p>
            ${toppingOptions(false) + toppingOptions(true)}
            ${paidExtraOptions()}
          ` : ''}
        </div>
        <div class="dialog-footer">
          <div class="dialog-quantity">
            <span>Quantidade</span>
            ${quantityStepper(quantity, product.title)}
          </div>
          <button class="dialog-action btn btn-primary builder-add" type="submit" data-add-product>
            <span>Adicionar à sacola</span><strong aria-live="polite" data-product-total>${formatPrice(product.prices[initialSize])}</strong>
          </button>
        </div>
      </form>`;

    const form = productContent.querySelector('form');
    const quantityValue = form.querySelector('[data-quantity]');
    const decrement = form.querySelector('[data-quantity-change="-1"]');
    const increment = form.querySelector('[data-quantity-change="1"]');
    const totalValue = form.querySelector('[data-product-total]');
    const addButton = form.querySelector('[data-add-product]');
    const limitMessage = form.querySelector('[data-topping-limit-message]');
    const sizeInput = form.elements.namedItem('size');
    const extraDetails = form.querySelector('.paid-extras');
    const extraTotal = form.querySelector('[data-paid-extra-total]');
    const extraInputs = [...form.querySelectorAll('[data-extra-topping]')];
    const groups = [...form.querySelectorAll('[data-topping-group]')].map((group) => ({
      type: group.dataset.toppingGroup,
      counter: group.querySelector('[data-topping-counter]'),
      options: [...group.querySelectorAll('input[name="topping"]')],
    }));
    const toppingInputs = groups.flatMap((group) => group.options);
    const toppingOrder = new Map();

    function selectedItem() {
      const extras = extraInputs.flatMap((input) => {
        const amount = input.valueAsNumber;
        return Number.isInteger(amount) && amount > 0 && amount <= MAX_QUANTITY
          ? [{ id: input.dataset.extraTopping, quantity: amount }]
          : [];
      });

      return {
        category,
        quantity,
        size: Number(sizeInput.value),
        toppings: toppingInputs.filter((input) => input.checked).map((input) => input.value),
        ...(category === 'mix' ? { pricingRule: TOPPING_PRICING_RULE } : {}),
        ...(extras.length ? { extras } : {}),
      };
    }

    function updateProduct(item = selectedItem()) {
      const price = formatPrice(lineTotal(item));
      if (totalValue.textContent !== price) totalValue.textContent = price;
      const extras = item.extras ?? [];
      const choices = new Map([
        ...item.toppings.map((id) => [id, { id, quantity: 1 }]),
        ...extras.map((extra) => [`extra:${extra.id}`, extra]),
      ]);
      for (const key of toppingOrder.keys()) {
        if (!choices.has(key)) toppingOrder.delete(key);
      }
      for (const [key, choice] of choices) {
        if (choice.quantity > (toppingOrder.get(key)?.quantity ?? 0)) toppingOrder.delete(key);
        toppingOrder.set(key, choice);
      }
      const lastToppingId = Array.from(toppingOrder.values()).at(-1)?.id;
      previewToppings([...item.toppings, ...extras.map(({ id }) => id)], lastToppingId);
      if (category !== 'mix') return true;

      extraTotal.textContent = formatPrice(extraToppingsTotal(item));
      const selection = toppingSelection(item);
      const { free, paid } = selection;
      const issue = toppingIssue(selection);
      for (const { type, counter, options } of groups) {
        const { count, limit } = selection[type];
        const other = type === 'free' ? paid : free;
        counter.textContent = `${count} de ${limit} selecionados`;
        for (const option of options) {
          option.disabled = !option.checked && (count >= limit || other.count > 0);
        }
      }

      let hint = 'Na seleção principal, escolha adicionais grátis ou pagos.';
      if (free.count) {
        hint = 'Desmarque os adicionais grátis para escolher os pagos.';
      } else if (paid.count) {
        hint = 'Desmarque os adicionais pagos para escolher os grátis.';
      }
      hint += ' Use Extras pagos para acrescentar porções.';

      const warnings = [];
      if (issue === 'mixed') {
        warnings.push('Escolha um tipo na seleção principal. Desmarque todos os grátis ou todos os pagos.');
      }
      if (free.count > free.limit) {
        warnings.push(`Desmarque adicionais grátis até ficar com ${free.limit} ou escolha um copo maior.`);
      }
      if (paid.count > paid.limit) {
        warnings.push(`Desmarque adicionais pagos até ficar com ${paid.limit}.`);
      }
      const message = warnings.length ? warnings.join(' ') : hint;
      if (limitMessage.textContent !== message) limitMessage.textContent = message;
      limitMessage.toggleAttribute('data-invalid', Boolean(issue));
      addButton.disabled = Boolean(issue);
      return !addButton.disabled;
    }

    function changeQuantity(amount) {
      quantity = Math.min(MAX_QUANTITY, Math.max(1, quantity + amount));
      quantityValue.value = String(quantity);
      decrement.disabled = quantity === 1;
      increment.disabled = quantity === MAX_QUANTITY;
      updateProduct();
    }

    form.addEventListener('change', () => updateProduct());
    form.addEventListener('input', (event) => {
      if (event.target.hasAttribute('data-extra-topping')) updateProduct();
    });
    form.addEventListener('invalid', (event) => {
      if (event.target.hasAttribute('data-extra-topping')) extraDetails.open = true;
    }, true);
    decrement.addEventListener('click', () => changeQuantity(-1));
    increment.addEventListener('click', () => changeQuantity(1));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const item = selectedItem();
      if (!Object.hasOwn(product.prices, item.size) || !updateProduct(item) || !form.reportValidity()) return;
      const existing = cart.find((line) => line.category === item.category && line.size === item.size
        && line.pricingRule === item.pricingRule && line.toppings.length === item.toppings.length
        && item.toppings.every((id) => line.toppings.includes(id))
        && JSON.stringify(line.extras ?? []) === JSON.stringify(item.extras ?? []));

      const previousQuantity = existing?.quantity ?? 0;
      const quantityAdded = Math.min(item.quantity, MAX_QUANTITY - previousQuantity);

      if (existing) {
        existing.quantity += quantityAdded;
      } else {
        cart.push(item);
      }

      saveCart();
      const message = quantityAdded === 1 ? '1 item adicionado à sacola.' : `${quantityAdded} itens adicionados à sacola.`;
      announce(quantityAdded > 0 ? message : 'Este copo já atingiu o limite de quantidade na sacola.');
    });

    updateProduct();
  }

  function renderPurchaseEnquiry(format) {
    const title = format === 'bottle' ? 'Garrafa de açaí de 350 ml' : formatTitles[format];
    productContent.innerHTML = `
      <h2 class="builder-product-title" id="product-title">${title}</h2>
      <p class="builder-quote-note">${format === 'bottle' ? 'Consulte o preço para 350 ml' : 'Consulte tamanhos e preços'} pelo WhatsApp. Se quiser, já escolha os adicionais de sua preferência.</p>
      <form id="product-form">
        <div class="dialog-body">
          <fieldset class="dialog-section">
            <legend>Adicionais de sua preferência</legend>
            <div class="builder-toppings">${toppings.map((topping) => toppingTile(topping)).join('')}</div>
          </fieldset>
        </div>
        <div class="dialog-footer">
          <button class="dialog-action btn btn-primary builder-add" type="submit"><span>Consultar pelo WhatsApp</span><strong>Sob consulta</strong></button>
        </div>
      </form>`;

    const form = productContent.querySelector('form');
    const selectedIds = () => [...form.querySelectorAll('input:checked')].map((input) => input.value);
    form.addEventListener('change', () => previewToppings(selectedIds()));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const selected = selectedIds().map((id) => toppingsById.get(id).name);
      const message = [`Olá! Gostaria de consultar o preço para: ${title}.`];
      if (selected.length) message.push(`Adicionais de preferência: ${selected.join(', ')}.`);
      window.location.href = `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(message.join('\n'))}`;
    });
  }

  function selectFormat(format) {
    formatButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.format === format)));
    cupVariants.hidden = format !== 'cup';
    previewToppings([]);
    const photo = format === 'cup' && cupVariant.startsWith('pure-') ? 'pure' : format;
    stage.dataset.stageFormat = format;
    stage.dataset.stagePhoto = photo;
    stageTitle.textContent = photo === 'pure' ? 'Copo de açaí puro' : format === 'bottle' ? 'Garrafa de açaí · 350 ml' : formatTitles[format];
    stagePhotos.forEach((image) => { image.hidden = image.dataset.formatPhoto !== photo; });
    if (format === 'cup') {
      variantButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.product === cupVariant)));
      openProduct(cupVariant);
    } else {
      renderPurchaseEnquiry(format);
    }
  }

  function orderTotals(fulfillment) {
    const subtotal = cart.reduce((total, item) => total + lineTotal(item), 0);
    const deliveryFee = fulfillment === 'delivery' ? DELIVERY_FEE_CENTS : 0;
    return { subtotal, deliveryFee, total: subtotal + deliveryFee };
  }

  function updateCheckout(form) {
    const address = form.querySelector('.checkout-address');
    const { subtotal, deliveryFee, total } = orderTotals(checkoutDraft.fulfillment);
    address.hidden = address.disabled = checkoutDraft.fulfillment !== 'delivery';
    form.querySelector('[data-checkout-subtotal]').textContent = formatPrice(subtotal);
    form.querySelector('[data-checkout-fee]').textContent = checkoutDraft.fulfillment ? formatPrice(deliveryFee) : '—';
    form.querySelector('[data-checkout-total]').textContent = checkoutDraft.fulfillment ? formatPrice(total) : '—';
  }

  function rememberCheckout(form) {
    for (const name of Object.keys(checkoutDraft)) {
      checkoutDraft[name] = form.elements.namedItem(name).value;
    }
  }

  function renderCart() {
    if (cart.length === 0) {
      for (const name of Object.keys(checkoutDraft)) checkoutDraft[name] = '';
      cartContent.innerHTML = `
        ${dialogHeader('cart-title', 'Sua sacola')}
        <div class="dialog-body cart-empty">
          <p>Sua sacola está vazia.</p>
          <a class="dialog-action btn btn-primary" href="#montar" data-close-dialog>Montar meu açaí</a>
        </div>`;
      return;
    }

    const previousForm = cartContent.querySelector('#checkout-form');
    if (previousForm) rememberCheckout(previousForm);

    const toppingIssues = cart.map(cartToppingIssue);
    const invalidCart = toppingIssues.some(Boolean);
    const toppingWarnings = {
      mixed: 'Este copo mistura grátis e pagos na seleção principal. Remova e monte novamente.',
      limit: 'Este copo passou do limite de adicionais na seleção principal. Remova e monte novamente.',
      repeated: 'Este copo repete um adicional na seleção principal. Remova e monte novamente.',
      price: 'Este copo foi montado com outra regra de preços. Remova e monte novamente para conferir o valor.',
    };
    cartContent.innerHTML = `
      ${dialogHeader('cart-title', 'Sua sacola')}
      <div class="dialog-body">
        <ul class="cart-items">
          ${cart.map((item, index) => {
            const name = `${categories[item.category].title} de ${item.size} ml`;
            const names = itemToppings(item).map((topping) => topping.name).join(', ');
            const extras = describeExtras(item);
            const warning = toppingWarnings[toppingIssues[index]];

            return `
              <li class="cart-item">
                <div class="cart-item-info">
                  <strong>${name}</strong>
                  ${names ? `<p class="cart-item-toppings">${names}</p>` : ''}
                  ${extras ? `<p class="cart-item-toppings">Extras por copo: ${extras}</p>` : ''}
                  ${warning ? `<p class="cart-line-warning">${warning}</p>` : ''}
                </div>
                <strong>${formatPrice(lineTotal(item))}</strong>
                <div class="cart-item-actions">
                  ${quantityStepper(item.quantity, name, index)}
                  <button class="cart-remove" type="button" data-remove="${index}" aria-label="Remover ${name}">Remover</button>
                </div>
              </li>`;
          }).join('')}
        </ul>
      </div>
      <form id="checkout-form" class="checkout-form" aria-labelledby="checkout-title" novalidate>
        <div class="dialog-body">
          <h3 class="checkout-heading" id="checkout-title">Dados do pedido</h3>
          <label class="checkout-field">
            Nome do cliente
            <input type="text" name="customerName" autocomplete="name" maxlength="100" required>
          </label>
          <fieldset class="checkout-fulfillment dialog-section">
            <legend>Como você quer receber?</legend>
            <div class="checkout-options dialog-options">
              <label class="dialog-choice"><input type="radio" name="fulfillment" value="delivery" required> Entrega <span class="dialog-choice-price">${formatPrice(DELIVERY_FEE_CENTS)}</span></label>
              <label class="dialog-choice"><input type="radio" name="fulfillment" value="pickup" required> Retirada</label>
            </div>
          </fieldset>
          <fieldset class="checkout-address dialog-section" hidden disabled>
            <legend>Endereço de entrega</legend>
            <div class="checkout-address-grid">
              <label class="checkout-field">
                Rua
                <input type="text" name="street" autocomplete="address-line1" maxlength="120" required>
              </label>
              <label class="checkout-field">
                Número
                <input type="text" name="streetNumber" maxlength="24" required>
              </label>
              <label class="checkout-field">
                Bairro
                <input type="text" name="neighborhood" autocomplete="address-level3" maxlength="80" required>
              </label>
            </div>
          </fieldset>
          <label class="checkout-field">
            <span>Observações <span class="checkout-optional">(opcional)</span></span>
            <textarea name="notes" rows="2" maxlength="300"></textarea>
          </label>
        </div>
        <div class="dialog-footer">
          <div class="checkout-totals" aria-live="polite" aria-atomic="true">
            <div class="dialog-total"><span>Subtotal</span><strong data-checkout-subtotal></strong></div>
            <div class="dialog-total"><span>Taxa de entrega</span><strong data-checkout-fee></strong></div>
            <div class="dialog-total checkout-grand-total"><span>Total do pedido</span><strong data-checkout-total></strong></div>
          </div>
          ${invalidCart ? '<p class="cart-checkout-warning">Remova os copos sinalizados para finalizar ou copiar o pedido.</p>' : ''}
          <button class="dialog-action btn btn-primary" type="submit" ${invalidCart ? 'disabled' : ''}>Enviar pedido pelo WhatsApp</button>
          <p class="checkout-note order-note">Confira a mensagem pronta e confirme o envio no WhatsApp.</p>
          <button class="dialog-secondary btn btn-secondary" type="button" data-copy-order ${invalidCart ? 'disabled' : ''}>Copiar pedido</button>
          <textarea class="order-summary" rows="4" aria-label="Resumo do pedido para copiar" data-copy-fallback readonly hidden></textarea>
          <p class="order-note" role="status" data-copy-status hidden></p>
        </div>
      </form>`;

    const form = cartContent.querySelector('#checkout-form');
    for (const name of Object.keys(checkoutDraft)) {
      form.elements.namedItem(name).value = checkoutDraft[name];
    }
    updateCheckout(form);
  }

  function orderSummary() {
    const delivery = checkoutDraft.fulfillment === 'delivery';
    const { subtotal, deliveryFee, total } = orderTotals(checkoutDraft.fulfillment);
    const message = [
      '🍧 *NOVO PEDIDO — AÇAÍ DOS DEUSES*',
      '',
      `👤 *Cliente:* ${checkoutDraft.customerName.trim()}`,
      `📦 *Recebimento:* ${delivery ? 'Entrega' : 'Retirada'}`,
    ];
    if (delivery) {
      message.push(
        `📍 *Endereço:* ${checkoutDraft.street.trim()}, ${checkoutDraft.streetNumber.trim()}`,
        `🏘️ *Bairro:* ${checkoutDraft.neighborhood.trim()}`,
      );
    }

    const lines = cart.flatMap((item) => {
      const name = `${categories[item.category].title} de ${item.size} ml`;
      const choices = itemToppings(item).map((topping) => topping.name).join(', ');
      const extras = describeExtras(item);
      const line = `• ${item.quantity} × ${name} — ${formatPrice(lineTotal(item))}`;
      const details = [line];
      if (choices) details.push(`  Adicionais: ${choices}`);
      if (extras) details.push(`  Extras por copo: ${extras}`);
      return details;
    });
    message.push(
      '', '🛒 *ITENS DO PEDIDO:*', ...lines, '',
      `💰 *Subtotal:* ${formatPrice(subtotal)}`,
      `🛵 *Taxa de entrega:* ${formatPrice(deliveryFee)}`,
      `💵 *TOTAL: ${formatPrice(total)}*`,
    );

    const notes = checkoutDraft.notes.trim();
    if (notes) message.push('', `📝 *Observações:* ${notes}`);
    message.push('', 'Aguardo a confirmação do pedido!');

    return message.join('\n');
  }

  function validCheckout(form) {
    if (cart.some(cartToppingIssue)) return false;
    rememberCheckout(form);
    updateCheckout(form);
    for (const name of ['customerName', 'street', 'streetNumber', 'neighborhood']) {
      const field = form.elements.namedItem(name);
      field.setCustomValidity(field.value.trim() ? '' : 'Preencha este campo.');
    }
    return form.reportValidity();
  }

  async function copyOrder(form, summary) {
    const field = form.querySelector('[data-copy-fallback]');
    const status = form.querySelector('[data-copy-status]');

    try {
      await navigator.clipboard.writeText(summary);
      field.hidden = true;
      status.textContent = 'Pedido copiado.';
    } catch {
      field.value = summary;
      field.hidden = false;
      status.textContent = 'Selecione e copie o resumo do seu pedido.';
      field.focus();
      field.select();
    }
    status.hidden = false;
  }

  formatButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-pressed') !== 'true') selectFormat(button.dataset.format);
    });
  });
  variantButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.product === cupVariant) return;
      cupVariant = button.dataset.product;
      selectFormat('cup');
    });
  });

  cartButtons.forEach((button) => {
    button.addEventListener('click', () => {
      renderCart();
      cartOpener = button;
      cartDialog.showModal();
    });
  });

  cartDialog.addEventListener('close', () => {
    if (cartOpener === floatingCart && floatingCart.hidden) {
      cartButtons[0].focus({ preventScroll: true });
    }
  });

  cartDialog.addEventListener('click', (event) => {
    if (event.target === cartDialog || event.target.closest('[data-close-dialog]')) cartDialog.close();
  });

  cartContent.addEventListener('change', (event) => {
    if (event.target.name !== 'fulfillment') return;
    const form = event.target.form;
    rememberCheckout(form);
    updateCheckout(form);
  });

  cartContent.addEventListener('input', (event) => {
    const form = event.target.form;
    if (form?.id !== 'checkout-form') return;
    form.querySelector('[data-copy-fallback]').hidden = true;
    form.querySelector('[data-copy-status]').hidden = true;
  });

  cartContent.addEventListener('submit', (event) => {
    if (event.target.id !== 'checkout-form') return;
    event.preventDefault();
    if (!cart.length || !validCheckout(event.target)) return;

    const url = `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(orderSummary())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  cartContent.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.hasAttribute('data-copy-order')) {
      const form = button.form;
      if (validCheckout(form)) void copyOrder(form, orderSummary());
      return;
    }

    if (button.hasAttribute('data-cart-index')) {
      const { cartIndex, quantityChange } = button.dataset;
      const item = cart[cartIndex];
      item.quantity = Math.min(MAX_QUANTITY, Math.max(1, item.quantity + Number(quantityChange)));
      saveCart();
      renderCart();
      const matches = [...cartContent.querySelectorAll(`[data-cart-index="${cartIndex}"]:enabled`)];
      const nextFocus = matches.find((step) => step.dataset.quantityChange === quantityChange) ?? matches[0];
      nextFocus?.focus();
      return;
    }

    if (button.hasAttribute('data-remove')) {
      const removeIndex = Number(button.dataset.remove);
      cart.splice(removeIndex, 1);
      saveCart();
      renderCart();
      const removeButtons = cartContent.querySelectorAll('[data-remove]');
      const nextFocus = removeButtons[Math.min(removeIndex, removeButtons.length - 1)]
        ?? cartContent.querySelector('.cart-empty a');
      nextFocus?.focus();
    }
  });

  const storeContact = document.querySelector('[data-store-contact]');
  storeContact.href = `https://wa.me/${STORE_WHATSAPP}`;
  storeContact.textContent = STORE_WHATSAPP.replace(/^55(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  document.querySelector('[data-delivery-price]').textContent = formatPrice(DELIVERY_FEE_CENTS);
  stage.style.setProperty('--topping-sheet', `url("${ingredientSheet.src}")`);
  ingredientLayer.style.setProperty('--texture-sheet', `url("${textureSheet.src}")`);
  selectFormat('cup');
  updateCartCount();
})();
