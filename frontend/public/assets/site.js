(function () {
  async function inject(id, file, onLoad) {
    const host = document.getElementById(id);
    if (!host) return;
    try {
      const res = await fetch(file);
      if (!res.ok) throw new Error("Failed to load " + file);
      host.innerHTML = await res.text();
      if (typeof onLoad === "function") {
        onLoad(host);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function initNav(root) {
    const header = root.querySelector(".site-header__inner");
    if (!header) return;
    const toggle = header.querySelector("[data-toggle=menu]");
    const nav = header.querySelector(".site-nav");
    if (!toggle || !nav) return;

    const dropdowns = Array.from(
      header.querySelectorAll("[data-nav-dropdown]")
    );

    const closeDropdowns = (except) => {
      dropdowns.forEach((item) => {
        if (except && item === except) return;
        item.setAttribute("data-open", "false");
        const trigger = item.querySelector(".site-nav__trigger");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      });
    };

    toggle.addEventListener("click", () => {
      const open = header.getAttribute("data-menu-open") === "true";
      header.setAttribute("data-menu-open", String(!open));
      toggle.setAttribute("aria-expanded", String(!open));
      if (open) {
        closeDropdowns();
      }
    });

    header.querySelectorAll(".site-nav a").forEach((link) => {
      link.addEventListener("click", () => {
        header.setAttribute("data-menu-open", "false");
        toggle.setAttribute("aria-expanded", "false");
        closeDropdowns();
      });
    });

    dropdowns.forEach((item) => {
      const trigger = item.querySelector(".site-nav__trigger");
      if (!trigger) return;
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        const open = item.getAttribute("data-open") === "true";
        if (open) {
          item.setAttribute("data-open", "false");
        } else {
          closeDropdowns(item);
          item.setAttribute("data-open", "true");
        }
        trigger.setAttribute("aria-expanded", String(!open));
      });
      item.querySelectorAll(".site-nav__menu-link").forEach((subLink) => {
        subLink.addEventListener("click", () => {
          item.setAttribute("data-open", "false");
          trigger.setAttribute("aria-expanded", "false");
        });
      });
    });

    document.addEventListener("click", (event) => {
      if (!header.contains(event.target)) {
        closeDropdowns();
      }
    });
  }

  function initFooter(root) {
    const yearEl = root.querySelector("#footer-year");
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }

    const form = root.querySelector('[data-role="subscribe-form"]');
    if (form) {
      const message = root.querySelector('[data-role="subscribe-message"]');
      const submitBtn = form.querySelector('button[type="submit"]');

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        const email = (formData.get("email") || "").toString().trim();

        if (!email) {
          if (message) {
            message.textContent = "Please enter a valid email.";
            message.style.color = "#dc3545";
          }
          return;
        }

        // Show loading state
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = "Subscribing...";
        if (message) message.textContent = "";

        try {
          // API base URL
          const API_BASE =
            window.CONTACT_API_BASE ||
            (window.location.hostname === "localhost" &&
            window.location.port === "8000"
              ? "http://localhost:7071/api"
              : "/api");

          const resp = await fetch(`${API_BASE}/newsletter/subscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });

          const contentType = resp.headers.get("content-type") || "";
          let result = {};

          if (contentType.includes("application/json")) {
            result = await resp.json();
          } else {
            const text = await resp.text();
            result = { message: text };
          }

          if (resp.ok && result.ok !== false) {
            form.reset();
            if (message) {
              message.textContent = result.message || "Thanks for subscribing!";
              message.style.color = "#28a745";
            }
          } else {
            throw new Error(
              result.error || result.message || "Failed to subscribe"
            );
          }
        } catch (error) {
          if (message) {
            message.textContent = "Error: " + error.message;
            message.style.color = "#dc3545";
          }
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (err) {
      return dateString;
    }
  }

  function truncateText(value, maxLength = 160) {
    if (!value) return "";
    const text = String(value).trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
  }

  function initGalleryPage() {
    const grid = document.querySelector("[data-gallery-grid]");
    if (!grid) return;

    const form = document.querySelector("[data-gallery-form]");
    const status = document.querySelector("[data-gallery-status]");
    if (status) {
      status.dataset.tone = "info";
    }
    const apiHost = window.PUBLIC_CONFIG?.API_BASE || "";
    const listUrl = `${apiHost}/gallery/public/list`;
    const uploadUrl = `${apiHost}/gallery/public/upload`;

    const setStatus = (message, tone = "info") => {
      if (!status) return;
      status.textContent = message;
      status.dataset.tone = tone;
    };

    const renderItems = (items) => {
      if (!items.length) {
        grid.innerHTML =
          '<div class="gallery-empty">No photos yet. Be the first to share!</div>';
        return;
      }
      const fragment = document.createDocumentFragment();
      items.forEach((item) => {
        const card = document.createElement("article");
        card.className = "gallery-card";
        const img = document.createElement("div");
        img.className = "gallery-card__image";
        img.style.backgroundImage = `url('${item.url}')`;
        img.setAttribute("role", "img");
        img.setAttribute(
          "aria-label",
          item.caption || item.filename || "Gallery photo"
        );
        card.appendChild(img);

        const body = document.createElement("div");
        body.className = "gallery-card__body";

        const caption = document.createElement("div");
        caption.className = "gallery-card__caption";
        caption.textContent = item.caption || "Shared photo";
        body.appendChild(caption);

        const meta = document.createElement("div");
        meta.className = "gallery-card__meta";
        const name = item.uploader ? `by ${item.uploader}` : "Community member";
        meta.innerHTML = `<span>${name}</span><span> · ${formatDate(
          item.uploadedAt
        )}</span>`;
        body.appendChild(meta);

        card.appendChild(body);
        fragment.appendChild(card);
      });
      grid.innerHTML = "";
      grid.appendChild(fragment);
    };

    const loadItems = async () => {
      grid.innerHTML =
        '<div class="gallery-empty">Loading community photos…</div>';
      try {
        const res = await fetch(listUrl, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = await res.json();
        renderItems(Array.isArray(data?.items) ? data.items : []);
      } catch (err) {
        console.error(err);
        grid.innerHTML =
          '<div class="gallery-empty">Unable to load photos right now.</div>';
      }
    };

    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const file = form.querySelector("input[name='file']")?.files?.[0];
        const caption = form
          .querySelector("input[name='caption']")
          ?.value.trim();
        const name = form.querySelector("input[name='name']")?.value.trim();

        if (!file) {
          setStatus("Please choose an image to upload.", "error");
          return;
        }

        if (file.size > 5 * 1024 * 1024) {
          setStatus("File is too large. Maximum size is 5 MB.", "error");
          return;
        }

        setStatus("Uploading…", "info");
        try {
          const dataUrl = await readFileAsDataUrl(file);
          const res = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
              data: dataUrl,
              caption,
              uploader: name,
              source: "public",
            }),
          });
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || `Upload failed: ${res.status}`);
          }
          form.reset();
          setStatus("Thanks! Your photo has been submitted.", "success");
          await loadItems();
        } catch (err) {
          console.error(err);
          setStatus(
            err?.message || "Upload failed. Please try again later.",
            "error"
          );
        }
      });
    }

    loadItems();
  }

  function initVolunteerForm() {
    const form = document.querySelector("[data-volunteer-form]");
    if (!form) return;
    const status = form.querySelector("[data-volunteer-status]");
    const hiddenEventId = form.querySelector("[data-volunteer-event-id]");
    const hiddenEventTitle = form.querySelector("[data-volunteer-event-title]");
    const selectedContainer = form.querySelector("[data-volunteer-selected]");
    const selectedText =
      (selectedContainer && selectedContainer.querySelector("[data-volunteer-selected-text]")) ||
      selectedContainer;
    const clearSelectedButton = form.querySelector("[data-volunteer-clear]");
    let selectedEvent = null;

    const updateSelected = (eventItem) => {
      selectedEvent = eventItem || null;
      if (hiddenEventId) hiddenEventId.value = selectedEvent?.id || "";
      if (hiddenEventTitle) hiddenEventTitle.value = selectedEvent?.title || "";
      if (selectedText) {
        if (selectedEvent?.title) {
          const formatted = formatEventDate(selectedEvent.date || "");
          const suffix = formatted ? ` on ${formatted}` : "";
          selectedText.textContent = "";
          selectedText.append(
            document.createTextNode("Registering interest for "),
            (() => {
              const strong = document.createElement("strong");
              strong.textContent = selectedEvent.title;
              return strong;
            })()
          );
          selectedText.append(
            document.createTextNode(`${suffix}.`)
          );
        } else {
          selectedText.textContent =
            "No event selected. Choose an event below or submit general interest.";
        }
      }
      if (clearSelectedButton) {
        clearSelectedButton.hidden = !selectedEvent;
      }
    };

    if (clearSelectedButton) {
      clearSelectedButton.addEventListener("click", () => {
        updateSelected(null);
      });
    }

    updateSelected(null);

    const setStatus = (message, tone = "info") => {
      if (status) {
        status.textContent = message;
        status.dataset.tone = tone;
      }
    };
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const name = (formData.get("name") || "").toString().trim();
      const email = (formData.get("email") || "").toString().trim();
      const password = (formData.get("password") || "").toString().trim();
      const confirmPassword = (formData.get("confirmPassword") || "")
        .toString()
        .trim();

      if (!email) {
        setStatus("Please add an email so we can contact you.", "error");
        return;
      }
      if (!password || password.length < 8) {
        setStatus(
          "Please choose a password with at least 8 characters.",
          "error"
        );
        return;
      }
      if (password !== confirmPassword) {
        setStatus("Passwords do not match.", "error");
        return;
      }

      const apiBase =
        (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.API_BASE) || "";
      if (!apiBase) {
        setStatus("API base URL is not configured.", "error");
        return;
      }

      const volunteerPayload = {
        name,
        email,
        phone: (formData.get("phone") || "").toString().trim(),
        notes: (formData.get("notes") || "").toString().trim(),
        eventId: (formData.get("eventId") || "").toString().trim(),
        eventTitle: (formData.get("eventTitle") || "").toString().trim(),
      };

      setStatus("Creating your account…", "info");

      let accountCreated = false;
      let accountExists = false;

      try {
        const registerRes = await fetch(`${apiBase}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });

        if (registerRes.status === 409) {
          accountExists = true;
        } else if (!registerRes.ok) {
          const text = await registerRes.text();
          throw new Error(
            text || `Could not create account (${registerRes.status})`
          );
        } else {
          accountCreated = true;
        }
      } catch (err) {
        console.error(err);
        setStatus(err.message || "Unable to create portal account.", "error");
        return;
      }

      setStatus("Saving your volunteer details…", "info");

      try {
        const res = await fetch(`${apiBase}/volunteers/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(volunteerPayload),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Request failed (${res.status})`);
        }
        const submittedEvent = selectedEvent;
        form.reset();
        updateSelected(submittedEvent);
        const baseMessage = accountCreated
          ? "Account created! Please log in at the volunteer portal. We'll be in touch shortly."
          : accountExists
          ? "You already have a portal account. We've recorded your interest and will be in touch."
          : "Thank you! We'll be in touch shortly.";
        const eventSummary = submittedEvent?.title
          ? ` Registered for ${submittedEvent.title}.`
          : "";
        setStatus(baseMessage + eventSummary, "success");
        const portalBase =
          (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.PORTAL_BASE) || "/portal";
        const loginUrl = `${portalBase.replace(/\/$/, "")}/login`;
        setTimeout(() => {
          window.location.href = loginUrl;
        }, 1200);
      } catch (err) {
        console.error(err);
        setStatus(
          err.message || "Submission failed. Please try again later.",
          "error"
        );
      }
    });

    window.__volunteerSetEvent = (eventItem) => {
      updateSelected(eventItem || null);
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  }

  function formatEventDate(value) {
    if (!value) return "";
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return value;
      }
      return new Intl.DateTimeFormat(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
    } catch (err) {
      return value;
    }
  }

  function renderVolunteerEvents(container, items) {
    if (!items || !items.length) {
      container.innerHTML =
        '<div class="volunteer-events__empty">No upcoming events at the moment.</div>';
      return;
    }
    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const card = document.createElement("article");
      card.className = "volunteer-event";

      const dateEl = document.createElement("div");
      dateEl.className = "volunteer-event__date";
      dateEl.textContent = formatEventDate(item.date);
      card.appendChild(dateEl);

      const body = document.createElement("div");
      body.className = "volunteer-event__body";

      const title = document.createElement("div");
      title.className = "volunteer-event__title";
      title.textContent = item.title || "Upcoming event";
      body.appendChild(title);

      const fullDescription = (item.description || "").trim();
      const truncatedDescription = truncateText(fullDescription, 180);
      let desc;
      if (fullDescription) {
        desc = document.createElement("p");
        desc.className = "volunteer-event__description";
        desc.textContent = truncatedDescription;
        body.appendChild(desc);
        if (truncatedDescription !== fullDescription) {
          let expanded = false;
          const toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "volunteer-event__more";
          toggle.textContent = "Show more";
          toggle.addEventListener("click", () => {
            expanded = !expanded;
            desc.textContent = expanded ? fullDescription : truncatedDescription;
            toggle.textContent = expanded ? "Show less" : "Show more";
          });
          body.appendChild(toggle);
        }
      }

      const action = document.createElement("button");
      action.type = "button";
      action.className = "volunteer-event__link";
      action.textContent = item.linkText || "Reserve a spot";
      action.addEventListener("click", () => {
        if (window.__volunteerSetEvent) {
          window.__volunteerSetEvent(item);
        }
      });
      body.appendChild(action);

      card.appendChild(body);
      fragment.appendChild(card);
    });
    container.innerHTML = "";
    container.appendChild(fragment);
  }

  function initVolunteerEvents() {
    const container = document.querySelector("[data-volunteer-events]");
    if (!container) return;
    const apiBase =
      (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.API_BASE) || "";
    if (!apiBase) {
      container.innerHTML =
        '<div class="volunteer-events__empty">Unable to load events at this time.</div>';
      return;
    }
    fetch(`${apiBase}/volunteers/events`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Request failed (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        renderVolunteerEvents(
          container,
          Array.isArray(data?.items) ? data.items : []
        );
      })
      .catch((err) => {
        console.error(err);
        container.innerHTML =
          '<div class="volunteer-events__empty">Unable to load events right now.</div>';
      });
  }

  function renderUpdates(container, items) {
    if (!items.length) {
      container.innerHTML =
        '<div class="updates-empty">No updates yet. Check back soon.</div>';
      return;
    }
    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "update-card";

      const image = document.createElement("div");
      image.className = "update-card__image";
      const fallbackImage =
        GALLERY_FALLBACK_IMAGES[index % GALLERY_FALLBACK_IMAGES.length];
      const imageUrl = item.imageUrl || fallbackImage;
      image.style.backgroundImage = `url('${imageUrl}')`;
      card.appendChild(image);

      const body = document.createElement("div");
      body.className = "update-card__body";

      if (item.category) {
        const tag = document.createElement("div");
        tag.className = "update-card__tag";
        tag.textContent = item.category;
        body.appendChild(tag);
      }

      const title = document.createElement("div");
      title.className = "update-card__title";
      title.textContent = item.title || "Project update";
      body.appendChild(title);

    const summaryText = item.summary || truncateText(item.detail, 160);
    if (summaryText) {
      const summary = document.createElement("p");
      summary.className = "update-card__excerpt";
      summary.textContent = summaryText;
      body.appendChild(summary);
    }

    const meta = document.createElement("div");
    meta.className = "update-card__meta";
    meta.textContent = `Updated ${formatDate(
      item.publishedAt || item.updatedAt || item.createdAt
    )}`;
    body.appendChild(meta);

    const hasDetailPage = Boolean(item.detail || item.summary);
    const detailLink = hasDetailPage
      ? `/update.html?id=${encodeURIComponent(item.id)}`
      : item.linkUrl;
    if (detailLink) {
      const link = document.createElement("a");
      link.className = "update-card__action";
      link.href = detailLink;
      const isExternal = /^https?:/i.test(detailLink) && !hasDetailPage;
      if (isExternal) {
        link.target = "_blank";
        link.rel = "noopener";
      }
      link.textContent = hasDetailPage ? "Read more" : "Visit link";
      body.appendChild(link);
    }

      card.appendChild(body);
      fragment.appendChild(card);
    });
    container.innerHTML = "";
    container.appendChild(fragment);
  }

  const GALLERY_FALLBACK_IMAGES = [
    "/gallery-media/IMG_1004.jpg",
    "/gallery-media/IMG_1354-2.jpg",
    "/gallery-media/update1.jpg",
    "/gallery-media/update2.jpg",
  ];

  function renderHomeUpdates(container, items) {
    const latest = items.slice(0, 4);
    if (!latest.length) {
      container.innerHTML =
        '<div class="updates-empty">Project updates will appear here soon.</div>';
      return;
    }
    const fragment = document.createDocumentFragment();
    latest.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "update-card";

      const image = document.createElement("div");
      image.className = "update-card__image";
      const fallbackImage =
        GALLERY_FALLBACK_IMAGES[index % GALLERY_FALLBACK_IMAGES.length];
      const imageUrl = item.imageUrl || fallbackImage;
      image.style.backgroundImage = `url('${imageUrl}')`;
      card.appendChild(image);

      const body = document.createElement("div");
      body.className = "update-card__body";

      if (item.category) {
        const tag = document.createElement("div");
        tag.className = "update-card__tag";
        tag.textContent = item.category;
        body.appendChild(tag);
      }

      const title = document.createElement("div");
      title.className = "update-card__title";
      title.textContent = item.title || "Project update";
      body.appendChild(title);

      const meta = document.createElement("p");
      meta.className = "update-card__meta";
      const dateText = formatDate(
        item.publishedAt || item.updatedAt || item.createdAt
      );
      meta.textContent = item.category
        ? `${dateText} · ${item.category}`
        : dateText;
      body.appendChild(meta);

      const excerpt = document.createElement("p");
      excerpt.className = "update-card__excerpt";
      excerpt.textContent = truncateText(
        item.summary || item.detail,
        180
      );
      body.appendChild(excerpt);

      const hasDetailPage = Boolean(item.detail || item.summary);
      const detailLink = hasDetailPage
        ? `/update.html?id=${encodeURIComponent(item.id)}`
        : item.linkUrl;
      if (detailLink) {
        const link = document.createElement("a");
        link.className = "update-card__action";
        link.href = detailLink;
        const isExternal = /^https?:/i.test(detailLink) && !hasDetailPage;
        if (isExternal) {
          link.target = "_blank";
          link.rel = "noopener";
        }
        link.textContent = hasDetailPage ? "Read more" : "Visit link";
        body.appendChild(link);
      }

      card.appendChild(body);
      fragment.appendChild(card);
    });
    container.innerHTML = "";
    container.appendChild(fragment);
  }

  function initPortalLinks() {
    const portalBase = window.PUBLIC_CONFIG?.PORTAL_BASE || "/portal";
    document.querySelectorAll("[data-portal-login]").forEach((el) => {
      el.setAttribute("href", `${portalBase}/login`);
    });
    document.querySelectorAll("[data-portal-register]").forEach((el) => {
      el.setAttribute("href", `${portalBase}/register`);
    });
  }

  function initHomeUpdates() {
    const container = document.querySelector("[data-home-updates]");
    if (!container) return;
    const apiBase =
      (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.API_BASE) || "";
    if (!apiBase) {
      container.innerHTML =
        '<div class="updates-empty">Latest updates are coming soon.</div>';
      return;
    }

    container.innerHTML =
      '<div class="updates-empty">Loading latest project updates…</div>';
    fetch(`${apiBase}/public/updates`, {
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Request failed (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        const items = Array.isArray(data?.items) ? data.items : [];
        renderHomeUpdates(container, items);
      })
      .catch((err) => {
        console.error(err);
        container.innerHTML =
          '<div class="updates-empty">Unable to load project updates right now.</div>';
      });
  }

  function initUpdatesPage() {
    const grid = document.querySelector("[data-updates-grid]");
    const refreshBtn = document.querySelector("[data-updates-refresh]");
    if (!grid) return;
    const apiBase =
      (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.API_BASE) || "";
    if (!apiBase) {
      grid.innerHTML =
        '<div class="updates-empty">Unable to load updates right now.</div>';
      return;
    }
    const hasStatic = grid.dataset.staticUpdates === "true";
    const eventsList = document.querySelector("[data-updates-events-list]");

    const renderUpcomingEvents = (listEl, items) => {
      if (!listEl) return;
      if (!items.length) {
        listEl.innerHTML =
          '<li class="updates-events__item updates-events__item--placeholder">No upcoming events at the moment.</li>';
        return;
      }
      const fragment = document.createDocumentFragment();
      items.slice(0, 3).forEach((event) => {
        const item = document.createElement("li");
        item.className = "updates-events__item";

        const meta = document.createElement("span");
        meta.className = "updates-events__meta";
        meta.textContent = formatDate(event.date);
        item.appendChild(meta);

        const title = document.createElement("strong");
        title.textContent = event.title || "Volunteer event";
        item.appendChild(title);

        if (event.description || event.linkText) {
          const description = document.createElement("p");
          description.className = "updates-events__description";
          description.textContent = truncateText(
            event.description || event.linkText,
            140
          );
          item.appendChild(description);
        }

        fragment.appendChild(item);
      });
      listEl.innerHTML = "";
      listEl.appendChild(fragment);
    };

    const loadUpcomingEvents = () => {
      if (!eventsList) return;
      eventsList.innerHTML =
        '<li class="updates-events__item updates-events__item--placeholder">Loading upcoming events…</li>';
      fetch(`${apiBase}/volunteers/events`, {
        headers: { Accept: "application/json" },
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `Request failed (${res.status})`);
          }
          return res.json();
        })
        .then((data) => {
          const items = Array.isArray(data?.items) ? data.items : [];
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const upcoming = items
            .filter((event) => {
              if (!event?.date) return false;
              const eventDate = new Date(event.date);
              if (Number.isNaN(eventDate.getTime())) return false;
              return eventDate >= today;
            })
            .sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );
          const source = upcoming.length ? upcoming : items.slice(0, 3);
          renderUpcomingEvents(eventsList, source || []);
        })
        .catch((err) => {
          console.error(err);
          renderUpcomingEvents(eventsList, []);
        });
    };

    if (hasStatic) {
      if (refreshBtn) {
        refreshBtn.style.display = "none";
      }
      loadUpcomingEvents();
      return;
    }

    const loadUpdates = () => {
      grid.innerHTML =
        '<div class="updates-empty">Loading project updates…</div>';
      fetch(`${apiBase}/public/updates`, {
        headers: { Accept: "application/json" },
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `Request failed (${res.status})`);
          }
          return res.json();
        })
        .then((data) => {
          const items = Array.isArray(data?.items) ? data.items : [];
          renderUpdates(grid, items);
        })
        .catch((err) => {
          console.error(err);
          grid.innerHTML =
            '<div class="updates-empty">Unable to load updates right now.</div>';
        });
    };

    loadUpdates();
    loadUpcomingEvents();

    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        refreshBtn.classList.add("is-loading");
        loadUpdates();
        setTimeout(() => refreshBtn.classList.remove("is-loading"), 600);
      });
    }
  }

  function renderDetailBody(container, detail) {
    if (!detail) {
      container.innerHTML = "";
      return;
    }
    const sections = detail
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);
    container.innerHTML = "";
    if (!sections.length) {
      const paragraph = document.createElement("p");
      paragraph.textContent = detail.trim();
      container.appendChild(paragraph);
      return;
    }
    sections.forEach((block) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = block;
      container.appendChild(paragraph);
    });
  }

  function initUpdateDetailPage() {
    const shell = document.querySelector("[data-update-detail]");
    if (!shell) return;
    const apiBase = (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.API_BASE) || "";
    if (!apiBase) {
      shell.innerHTML =
        '<div class="update-detail__error">API is not configured.</div>';
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const updateId = params.get("id");
    if (!updateId) {
      shell.innerHTML =
        '<div class="update-detail__error">Update not found.</div>';
      return;
    }

    shell.innerHTML = '<div class="update-detail__loading">Loading update…</div>';
    fetch(`${apiBase}/public/updates/${encodeURIComponent(updateId)}`, {
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Request failed (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        const item = data?.item;
        if (!item) {
          throw new Error("Update not found");
        }
        const container = document.createElement("div");
        container.className = "update-detail__content";

        const backLink = document.createElement("a");
        backLink.className = "update-detail__back";
        backLink.href = "/latest-updates.html";
        backLink.innerHTML = "&larr; Back to updates";
        container.appendChild(backLink);

        const title = document.createElement("h1");
        title.className = "update-detail__title";
        title.textContent = item.title || "Project update";
        container.appendChild(title);

        const meta = document.createElement("div");
        meta.className = "update-detail__meta";
        const date = document.createElement("span");
        date.textContent = `Published ${formatDate(
          item.publishedAt || item.updatedAt || item.createdAt
        )}`;
        meta.appendChild(date);
        if (item.category) {
          const category = document.createElement("span");
          category.className = "update-detail__category";
          category.textContent = item.category;
          meta.appendChild(category);
        }
        container.appendChild(meta);

        if (item.summary) {
          const summary = document.createElement("p");
          summary.className = "update-detail__summary";
          summary.textContent = item.summary;
          container.appendChild(summary);
        }

        const detailImageUrl =
          item.imageUrl || GALLERY_FALLBACK_IMAGES[0];
        if (detailImageUrl) {
          const media = document.createElement("div");
          media.className = "update-detail__image";
          const img = document.createElement("img");
          img.alt = item.title || "Project update";
          img.src = detailImageUrl;
          media.appendChild(img);
          container.appendChild(media);
        }

        const body = document.createElement("div");
        body.className = "update-detail__body";
        renderDetailBody(body, item.detail || item.summary || "");
        container.appendChild(body);

        if (item.linkUrl) {
          const external = document.createElement("a");
          external.className = "update-detail__external";
          external.href = item.linkUrl;
          external.target = "_blank";
          external.rel = "noopener";
          external.textContent = "Visit related link";
          container.appendChild(external);
        }

        shell.innerHTML = "";
        shell.appendChild(container);
      })
      .catch((err) => {
        console.error(err);
        shell.innerHTML =
          '<div class="update-detail__error">Unable to load this update.</div>';
      });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const overlayPages = [
      "home-page",
      "updates-page",
      "gallery-page",
      "donate-page",
      "volunteer-page",
    ];
    const useOverlay = overlayPages.some((cls) =>
      document.body.classList.contains(cls)
    );
    inject("navbar", "/partials/navbar.html", (host) => {
      if (!useOverlay) {
        const header = host.querySelector(".site-header");
        if (header) header.classList.add("site-header--solid");
      }
      initNav(host);
    });
    inject("footer", "/partials/footer.html", initFooter);
    initVolunteerForm();
    initVolunteerEvents();
    initGalleryPage();
    initPortalLinks();
    initHomeUpdates();
    initUpdateDetailPage();
    initUpdatesPage();
  });
})();
