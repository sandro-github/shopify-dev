/**
 * Cart Drawer Upsell - Complementary Products
 * Dawn Theme 15.4.0
 * Custom Element: <sjm-cart-upsell>
 */

if (!customElements.get("sjm-cart-upsell")) {
  class SjmCartUpsell extends HTMLElement {
    constructor() {
      super()
      this.swiper = null
      this.currentProductId = null
      this.cartItems = []
      this.initialized = false
    }

    connectedCallback() {
      // Element inserted into DOM - initialize
      if (!this.initialized) {
        this.init()
        this.initialized = true
      }
    }

    disconnectedCallback() {
      // Element removed from DOM - cleanup
      if (this.swiper) {
        this.swiper.destroy(true, true)
        this.swiper = null
      }
    }

    init() {
      this.loadSwiper(() => {
        this.interceptFetch()
        this.bindEvents()
        this.fetchCartAndRender()
      })
    }

    loadSwiper(callback) {
      if (window.Swiper) {
        callback()
        return
      }

      const checkSwiper = setInterval(() => {
        if (window.Swiper) {
          clearInterval(checkSwiper)
          callback()
        }
      }, 50)

      // Timeout after 5 seconds
      setTimeout(() => clearInterval(checkSwiper), 5000)
    }

    interceptFetch() {
      if (window._sjmFetchIntercepted) return
      window._sjmFetchIntercepted = true

      const originalFetch = window.fetch
      

      window.fetch = function () {
        const args = arguments
        const url = args[0]

        return originalFetch.apply(this, args).then((response) => {
          if (typeof url === "string") {
            if (
              url.indexOf("/cart/add") !== -1 ||
              url.indexOf("/cart/change") !== -1 ||
              url.indexOf("/cart/update") !== -1 ||
              url.indexOf("/cart/clear") !== -1
            ) {
              setTimeout(() => {
                // Find all instances and refresh
                document.querySelectorAll("sjm-cart-upsell").forEach((el) => {
                  el.currentProductId = null
                  el.fetchCartAndRender()
                })
              }, 300)
            }
          }
          return response
        })
      }
    }

    bindEvents() {
      // Add to cart (single variant)
      this.addEventListener("click", (e) => {
        const addBtn = e.target.closest("[data-upsell-add-btn]")
        if (addBtn && !addBtn.disabled) {
          e.preventDefault()
          this.addToCart(addBtn.dataset.variantId, addBtn)
          return
        }

        // Select options toggle
        const selectBtn = e.target.closest("[data-upsell-select-btn]")
        if (selectBtn) {
          e.preventDefault()
          this.toggleVariants(selectBtn)
          return
        }

        // Add selected variant
        const addSelectedBtn = e.target.closest("[data-add-selected-variant]")
        if (addSelectedBtn && !addSelectedBtn.disabled) {
          e.preventDefault()
          this.addToCart(addSelectedBtn.dataset.variantId, addSelectedBtn)
          return
        }
      })

      // Variant selection
      this.addEventListener("change", (e) => {
        const input = e.target.closest("[data-variant-input]")
        if (!input) return
        this.handleVariantChange(input)
      })
    }

    fetchCartAndRender() {
      fetch("/cart.js")
        .then((res) => res.json())
        .then((cart) => {
          this.cartItems = cart.items || []

          if (this.cartItems.length === 0) {
            this.hide()
            return
          }

          const lastItem = this.cartItems[this.cartItems.length - 1]
          const productId = lastItem.product_id

          if (productId === this.currentProductId) return
          this.currentProductId = productId

          this.fetchProducts(productId)
        })
        .catch(() => {
          this.hide()
        })
    }

    fetchProducts(productId) {
      fetch(`/recommendations/products.json?product_id=${productId}&limit=10&intent=complementary`)
        .then((res) => res.json())
        .then((data) => {
          let products = data.products || []
          const cartIds = this.cartItems.map((item) => item.product_id)
          products = products.filter((p) => cartIds.indexOf(p.id) === -1)

          if (products.length === 0) {
            this.parentNode.hide();
            console.log('No upsell for product ID ', productId)
          }

          this.renderProducts(products);
          this.parentNode.show();
        })
        .catch(() => {
          this.parentNode.hide();
        })
    }
    
    renderProducts(products) {
      const wrapper = this.querySelector("[data-upsell-products]")
      const template = document.getElementById("upsell-product-template")

      if (!wrapper || !template) return

      wrapper.innerHTML = ""

      products.forEach((product) => {
        const clone = template.content.cloneNode(true)
        const card = clone.querySelector("[data-upsell-item]")

        if (!card) return

        card.dataset.productId = product.id
        card.dataset.productHandle = product.handle

        // Image
        const img = card.querySelector("[data-upsell-image]")
        if (img) {
          img.src = product.featured_image ? this.getSizedImage(product.featured_image, "200x200") : ""
          img.alt = product.title
        }

        // Links
        card.querySelectorAll("[data-upsell-link], [data-upsell-title]").forEach((el) => {
          el.href = "/products/" + product.handle
        })

        // Title
        const title = card.querySelector("[data-upsell-title]")
        if (title) title.textContent = product.title

        // Price
        const variant = product.variants[0]
        const priceEl = card.querySelector("[data-regular-price]")
        const compareEl = card.querySelector("[data-compare-price]")

        if (priceEl) priceEl.textContent = this.formatMoney(variant.price)
        if (compareEl) {
          if (variant.compare_at_price && variant.compare_at_price > variant.price) {
            compareEl.textContent = this.formatMoney(variant.compare_at_price)
            compareEl.style.display = "inline"
          } else {
            compareEl.style.display = "none"
          }
        }

        // Buttons
        const addBtn = card.querySelector("[data-upsell-add-btn]")
        const selectBtn = card.querySelector("[data-upsell-select-btn]")
        const hasVariants = product.variants.length > 1

        if (hasVariants) {
          if (addBtn) addBtn.style.display = "none"
          if (selectBtn) {
            selectBtn.style.display = "block"
            card.dataset.variants = JSON.stringify(product.variants)
          }
        } else {
          if (selectBtn) selectBtn.style.display = "none"
          if (addBtn) {
            addBtn.style.display = "block"
            addBtn.dataset.variantId = variant.id
            if (!variant.available) {
              addBtn.disabled = true
              addBtn.textContent = "Sold Out"
            }
          }
        }

        wrapper.appendChild(card)
      })

      this.show()
      this.initSwiper()
    }

    initSwiper() {
      const swiperEl = this.querySelector(".cart-upsell-swiper")
      const prevBtn = this.querySelector(".cart-upsell-button-prev")
      const nextBtn = this.querySelector(".cart-upsell-button-next")

      if (!swiperEl || !window.Swiper) return

      if (this.swiper) {
        this.swiper.destroy(true, true)
        this.swiper = null
      }

      this.swiper = new window.Swiper(swiperEl, {
        slidesPerView: 1.25,
        spaceBetween: 2,
        grabCursor: true,
        touchEventsTarget: "container",
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
      })
    }

    toggleVariants(btn) {
      const card = btn.closest("[data-upsell-item]")
      const variantsEl = card.querySelector("[data-upsell-variants]")
      const actionsEl = card.querySelector(".cart-upsell__actions")

      if (variantsEl.style.display === "none" || !variantsEl.style.display) {
        this.buildVariants(card)
        variantsEl.style.display = "block"
        if (actionsEl) actionsEl.style.display = "none"
        btn.textContent = "Close"
      } else {
        variantsEl.style.display = "none"
        if (actionsEl) actionsEl.style.display = "block"
        btn.textContent = "Select Options"
      }

      if (this.swiper) this.swiper.update()
    }

    buildVariants(card) {
      const wrapper = card.querySelector("[data-variants-wrapper]")
      const template = document.getElementById("upsell-variant-template")
      const variants = JSON.parse(card.dataset.variants || "[]")
      const productId = card.dataset.productId

      if (!wrapper || !template || wrapper.children.length > 0) return

      variants.forEach((variant) => {
        const clone = template.content.cloneNode(true)
        const input = clone.querySelector("[data-variant-input]")
        const label = clone.querySelector("[data-variant-label]")

        if (!input || !label) return

        const inputId = "variant-" + productId + "-" + variant.id
        input.name = "variant-" + productId
        input.id = inputId
        input.value = variant.id
        input.disabled = !variant.available

        label.setAttribute("for", inputId)
        label.textContent = variant.title

        wrapper.appendChild(clone)
      })
    }

    handleVariantChange(input) {
      const card = input.closest("[data-upsell-item]")
      const addBtn = card.querySelector("[data-add-selected-variant]")

      if (addBtn) {
        addBtn.disabled = false
        addBtn.dataset.variantId = input.value

        // Update price
        const variants = JSON.parse(card.dataset.variants || "[]")
        const selected = variants.find((v) => v.id == input.value)
        if (selected) {
          const priceEl = card.querySelector("[data-regular-price]")
          const compareEl = card.querySelector("[data-compare-price]")
          if (priceEl) priceEl.textContent = this.formatMoney(selected.price)
          if (compareEl) {
            if (selected.compare_at_price && selected.compare_at_price > selected.price) {
              compareEl.textContent = this.formatMoney(selected.compare_at_price)
              compareEl.style.display = "inline"
            } else {
              compareEl.style.display = "none"
            }
          }
        }
      }
    }

    addToCart(variantId, btn) {
      if (!variantId) return

      const originalText = btn.textContent
      btn.classList.add("is-loading")
      btn.disabled = true

      fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ id: Number.parseInt(variantId), quantity: 1 }] }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed")
          return res.json()
        })
        .then(() => {
          btn.classList.remove("is-loading")
          btn.textContent = "Added!"

          this.refreshCartDrawer()

          setTimeout(() => {
            btn.textContent = originalText
            btn.disabled = false
          }, 1500)
        })
        .catch(() => {
          btn.classList.remove("is-loading")
          btn.textContent = "Error"
          setTimeout(() => {
            btn.textContent = originalText
            btn.disabled = false
          }, 2000)
        })
    }

    refreshCartDrawer() {
      const route = (window.routes && window.routes.cart_url) || "/cart"

      fetch(route + "?section_id=cart-drawer")
        .then((res) => res.text())
        .then((html) => {
          const parser = new DOMParser()
          const doc = parser.parseFromString(html, "text/html")
          const newContent = doc.querySelector("cart-drawer")
          const cartDrawer = document.querySelector("cart-drawer")

          if (newContent && cartDrawer) {
            cartDrawer.innerHTML = newContent.innerHTML
          }
        })
    }

    formatMoney(cents) {
      return "$" + (cents / 100).toFixed(2)
    }

    getSizedImage(url, size) {
      if (!url) return ""
      const match = url.match(/\.(jpg|jpeg|gif|png|webp)(\?v=\d+)?$/i)
      if (match) {
        return url.replace(match[0], "_" + size + match[0])
      }
      return url
    }

    show() {
      this.style.display = "block"
    }

    hide() {
      this.style.display = "none"
    }
  }

  customElements.define("sjm-cart-upsell", SjmCartUpsell)
}
