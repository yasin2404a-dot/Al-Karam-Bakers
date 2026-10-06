/* =========================================================
   Alkaram Bakers - script.js
   Cart, checkout, sliders, menu/gallery filters, forms
========================================================= */

/* ---------- SETTINGS (edit these before publishing) ---------- */
const SETTINGS = {
    // WhatsApp number in international format without + or spaces, e.g. "923001234567".
    // When set, a placed order is also sent to this WhatsApp number.
    whatsappNumber: "",
    // Contact form messages open the visitor's email app addressed to this email.
    contactEmail: "info@alkarambakers.com",
    deliveryFee: 150,
    freeDeliveryOver: 2000          // matches the "Free delivery over Rs. 2,000" offer
};

document.addEventListener("DOMContentLoaded", () => {
    const $  = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const money = v => "Rs. " + Number(v).toLocaleString("en-PK");
    const esc = v => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));

    /* safe localStorage (private mode / blocked storage must not break the site) */
    const store = {
        get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    };

    /* =====================  CART  ===================== */
    const cartDrawer = $("#cartDrawer"), cartOverlay = $("#cartOverlay"), cartItems = $("#cartItems");
    const checkoutModal = $("#checkoutModal"), orderSuccess = $("#orderSuccess");

    let cart = store.get("alkaramCart", []);
    if (!Array.isArray(cart)) cart = [];
    cart = cart.filter(i => i && i.name && Number(i.price) > 0 && Number(i.qty) > 0);

    const totals = () => {
        const count = cart.reduce((s, i) => s + i.qty, 0);
        const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
        const delivery = count === 0 || subtotal >= SETTINGS.freeDeliveryOver ? 0 : SETTINGS.deliveryFee;
        return { count, subtotal, delivery, total: subtotal + delivery };
    };

    function renderCart() {
        const t = totals();
        $("#cartCount").textContent = t.count;
        $("#cartSubtotal").textContent = money(t.subtotal);
        $("#cartDelivery").textContent = t.count && !t.delivery ? "Free" : money(t.delivery);
        $("#cartTotal").textContent = money(t.total);
        $("#checkoutTotal").textContent = money(t.total);
        $("#checkoutButton").disabled = !t.count;

        if (!cart.length) {
            cartItems.innerHTML = `<div class="empty-cart"><i class="bi bi-bag-x"></i><h4>Your cart is empty</h4><p>Add some delicious bakery items to continue.</p></div>`;
            return;
        }
        cartItems.innerHTML = cart.map((item, i) => `
            <div class="cart-item">
                <div>
                    <h5>${esc(item.name)}</h5>
                    <small>${money(item.price)} each</small>
                    <div class="qty-controls">
                        <button type="button" aria-label="Decrease quantity" data-action="minus" data-index="${i}">−</button>
                        <strong>${item.qty}</strong>
                        <button type="button" aria-label="Increase quantity" data-action="plus" data-index="${i}">+</button>
                        <button type="button" class="remove-item" data-action="remove" data-index="${i}">Remove</button>
                    </div>
                </div>
                <strong>${money(item.price * item.qty)}</strong>
            </div>`).join("");
    }

    function saveCart() { store.set("alkaramCart", cart); renderCart(); }

    function addToCart(name, price) {
        price = Number(price);
        if (!name || !(price > 0)) return;
        // same name AND same price = same item (two products can never merge by accident)
        const ex = cart.find(i => i.name === name && i.price === price);
        ex ? ex.qty++ : cart.push({ name, price, qty: 1 });
        saveCart();
        openCart();
    }

    function setBodyLock() {
        const open = cartDrawer.classList.contains("open") || checkoutModal.classList.contains("show") || orderSuccess.classList.contains("show");
        document.body.style.overflow = open ? "hidden" : "";
    }
    function openCart()  { cartDrawer.classList.add("open"); cartOverlay.classList.add("show"); setBodyLock(); }
    function hideCart()  { cartDrawer.classList.remove("open"); cartOverlay.classList.remove("show"); setBodyLock(); }
    function closeCheckout() { checkoutModal.classList.remove("show"); setBodyLock(); }

    document.addEventListener("click", e => {
        const add = e.target.closest(".add-to-cart");
        if (add) { e.preventDefault(); addToCart(add.dataset.product, add.dataset.price); return; }

        const act = e.target.closest("[data-action]");
        if (!act) return;
        const i = Number(act.dataset.index), item = cart[i];
        if (!item) return;
        if (act.dataset.action === "plus") item.qty++;
        if (act.dataset.action === "minus" && --item.qty <= 0) cart.splice(i, 1);
        if (act.dataset.action === "remove") cart.splice(i, 1);
        saveCart();
    });

    $("#cartButton").addEventListener("click", openCart);
    $("#closeCart").addEventListener("click", hideCart);
    cartOverlay.addEventListener("click", hideCart);

    $("#checkoutButton").addEventListener("click", () => {
        if (!cart.length) return;
        checkoutModal.classList.add("show");
        setBodyLock();
        setTimeout(() => $("#customerName").focus(), 50);
    });
    $("#closeCheckout").addEventListener("click", closeCheckout);
    checkoutModal.addEventListener("click", e => { if (e.target === checkoutModal) closeCheckout(); });

    $("#checkoutForm").addEventListener("submit", e => {
        e.preventDefault();
        if (!cart.length) return;
        const f = e.target, t = totals();
        const order = {
            orderId: "AK-" + Date.now().toString().slice(-6),
            customer: $("#customerName").value.trim(),
            phone: $("#customerPhone").value.trim(),
            address: $("#customerAddress").value.trim(),
            payment: $("#paymentMethod").value,
            items: cart.map(i => ({ ...i })),
            subtotal: t.subtotal, delivery: t.delivery, total: t.total,
            date: new Date().toISOString()
        };
        store.set("alkaramLastOrder", order);

        let msg = `Order ${order.orderId} has been placed. Total: ${money(order.total)}.`;
        if (SETTINGS.whatsappNumber) {
            const lines = [
                `*New Order ${order.orderId} - Alkaram Bakers*`,
                ...order.items.map(i => `• ${i.name} x${i.qty} = ${money(i.price * i.qty)}`),
                `Subtotal: ${money(order.subtotal)}`,
                `Delivery: ${order.delivery ? money(order.delivery) : "Free"}`,
                `*Total: ${money(order.total)}*`,
                `Payment: ${order.payment}`,
                `Name: ${order.customer}`, `Phone: ${order.phone}`, `Address: ${order.address}`
            ];
            window.open(`https://wa.me/${SETTINGS.whatsappNumber}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener");
            msg += " Your order details were opened in WhatsApp - please press Send to confirm.";
        }
        $("#successMessage").textContent = msg;

        cart = [];
        saveCart();
        f.reset();
        checkoutModal.classList.remove("show");
        hideCart();
        orderSuccess.classList.add("show");
        setBodyLock();
    });

    $("#successClose").addEventListener("click", () => { orderSuccess.classList.remove("show"); setBodyLock(); });

    document.addEventListener("keydown", e => {
        if (e.key !== "Escape") return;
        hideCart(); closeCheckout(); orderSuccess.classList.remove("show"); setBodyLock();
    });

    renderCart();

    /* =====================  NAVBAR  ===================== */
    const menuToggle = $("#menuToggle"), navMenu = $("#navMenu");
    const setMenu = open => {
        navMenu.classList.toggle("show", open);
        menuToggle.setAttribute("aria-expanded", String(open));
    };
    menuToggle.addEventListener("click", () => setMenu(!navMenu.classList.contains("show")));
    $$("a", navMenu).forEach(a => a.addEventListener("click", () => setMenu(false)));

    const backToTop = $("#backToTop");
    const navLinks = $$(".nav-link");
    const navSections = navLinks.map(l => $(l.getAttribute("href"))).filter(Boolean);
    const onScroll = () => {
        backToTop && backToTop.classList.toggle("show", window.scrollY > 500);
        let cur = "home";
        navSections.forEach(s => { if (window.scrollY >= s.offsetTop - 140) cur = s.id; });
        navLinks.forEach(l => l.classList.toggle("active", l.getAttribute("href") === "#" + cur));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* =====================  IMAGE FALLBACK  ===================== */
    const fallback = img => {
        if (img.dataset.fb) return;
        img.dataset.fb = 1;
        img.src = "images/alkaram-logo.png";
        img.classList.add("img-fallback");
    };
    $$("img").forEach(img => {
        img.addEventListener("error", () => fallback(img));
        if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) fallback(img);   // already failed before this script ran
    });

    /* =====================  SLIDERS  ===================== */
    function slider(items, dots, prev, next, activeDot, ms) {
        if (!items.length) return;
        let i = 0, timer;
        const show = n => {
            i = (n + items.length) % items.length;
            items.forEach((el, k) => el.classList.toggle("active", k === i));
            dots.forEach((d, k) => { d.classList.toggle(activeDot, k === i); d.setAttribute("aria-label", "Go to slide " + (k + 1)); });
        };
        const auto = () => { clearInterval(timer); timer = setInterval(() => show(i + 1), ms); };
        prev && prev.addEventListener("click", () => { show(i - 1); auto(); });
        next && next.addEventListener("click", () => { show(i + 1); auto(); });
        dots.forEach((d, k) => d.addEventListener("click", () => { show(k); auto(); }));
        show(0); auto();
    }
    slider($$(".bakery-slider .slide"), $$(".bakery-slider .dot"), $(".bakery-slider .prev"), $(".bakery-slider .next"), "active-dot", 5000);
    slider($$(".bakery-slide"), $$(".bakery-dot"), $(".bakery-prev"), $(".bakery-next"), "active", 4500);

    /* =====================  MENU FILTER  ===================== */
    const menuCards = $$(".menu-card"), menuEmpty = $("#menuEmpty");
    function filterMenu(cat) {
        let shown = 0;
        $$("[data-menu-filter]").forEach(b => b.classList.toggle("active", b.dataset.menuFilter === cat));
        menuCards.forEach(c => { const ok = cat === "all" || c.dataset.category === cat; c.style.display = ok ? "" : "none"; if (ok) shown++; });
        if (menuEmpty) menuEmpty.hidden = shown > 0;
    }
    $$("[data-menu-filter]").forEach(b => b.addEventListener("click", () => filterMenu(b.dataset.menuFilter)));
    $$(".view-category").forEach(a => a.addEventListener("click", () => filterMenu(a.dataset.filter)));

    /* keep "From Rs." on the category cards in sync with the real menu prices */
    $$(".category-card").forEach(card => {
        const cat = card.dataset.product.toLowerCase();
        const prices = menuCards.filter(c => c.dataset.category === cat).map(c => Number($(".category-add", c).dataset.price)).filter(Boolean);
        if (!prices.length) return;
        const min = Math.min(...prices);
        card.dataset.price = min;
        $(".category-add", card).dataset.price = min;
        $(".price-tag", card).textContent = "From " + money(min);
    });

    /* =====================  GALLERY  ===================== */
    const galleryItems = $$(".gallery-item");
    $$("#gallery .filter-btn").forEach(b => b.addEventListener("click", () => {
        $$("#gallery .filter-btn").forEach(x => x.classList.toggle("active", x === b));
        galleryItems.forEach(it => it.style.display = (b.dataset.filter === "all" || it.classList.contains(b.dataset.filter)) ? "" : "none");
    }));
    galleryItems.forEach(card => {
        const open = () => {
            $("#modalImage").src = $("img", card).src;
            $("#modalImage").alt = $("img", card).alt;
            $("#modalTitle").textContent = $("h4", card).textContent;
            if (window.bootstrap) bootstrap.Modal.getOrCreateInstance($("#imageModal")).show();
        };
        card.addEventListener("click", open);
        card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });

    /* =====================  VISITOR COUNTER  ===================== */
    const vc = $("#visitorCount");
    if (vc) {
        let v = parseInt(store.get("bakerzVisitors", NaN), 10);
        v = isNaN(v) ? 1256 : v + 1;
        store.set("bakerzVisitors", v);
        vc.textContent = String(v).padStart(5, "0");
    }

    /* =====================  CONTACT FORM  ===================== */
    const cf = $("#contactForm");
    cf && cf.addEventListener("submit", e => {
        e.preventDefault();
        const name = $("#cName").value.trim(), email = $("#cEmail").value.trim(), msg = $("#cMsg").value.trim();
        store.set("alkaramLastMessage", { name, email, msg, date: new Date().toISOString() });
        const subject = encodeURIComponent("Website message from " + name);
        const body = encodeURIComponent(`${msg}\n\nName: ${name}\nEmail: ${email}`);
        $("#contactNote").textContent = "Thank you! Your email app is opening so you can send your message.";
        cf.reset();
        window.location.href = `mailto:${SETTINGS.contactEmail}?subject=${subject}&body=${body}`;
    });
});
