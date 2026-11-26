import { Link } from 'react-router-dom';
import './landing.css';

const FEATURES = [
  {
    number: '01',
    title: 'Отвечает сразу',
    text: 'Не оставляет сообщение без ответа, пока администратор занят или клиника закрыта.',
    icon: '↗',
  },
  {
    number: '02',
    title: 'Записывает в календарь',
    text: 'Проверяет свободное время и помогает пациенту выбрать подходящий приём.',
    icon: '▦',
  },
  {
    number: '03',
    title: 'Передаёт сложные вопросы',
    text: 'Если нужна помощь человека, направляет диалог команде — без догадок и медицинских советов.',
    icon: '↗',
  },
];

const STEPS = [
  ['Подключите канал', 'Разместите веб-чат на сайте или подключите WhatsApp.'],
  ['Добавьте знания клиники', 'Внесите услуги, цены, врачей и расписание.'],
  ['Контролируйте работу', 'Следите за диалогами, записями и вопросами, требующими внимания.'],
];

export function LandingPage() {
  return (
    <main className="landing" id="top">
      <header className="landing-header">
        <Link className="landing-brand" to="/" aria-label="OzimAI — на главную">
          Ozim<span>AI</span>
          <i>для клиник</i>
        </Link>
        <nav className="landing-nav" aria-label="Главная навигация">
          <a href="#how-it-works">Как работает</a>
          <a href="#benefits">Возможности</a>
          <a href="#safety">Контроль</a>
        </nav>
        <div className="landing-header-actions">
          <Link className="landing-login" to="/login">Войти</Link>
          <Link className="landing-button landing-button-small" to="/login">Подключить клинику <span>↗</span></Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-eyebrow"><span className="landing-eyebrow-dot" /> AI-администратор для клиник</div>
          <h1>Пока вы лечите,<br />OzimAI <em>отвечает.</em></h1>
          <p className="landing-hero-lead">
            Отвечает пациентам, помогает записаться и напоминает о визите — чтобы команда клиники
            могла сосредоточиться на людях, а не на потоке сообщений.
          </p>
          <div className="landing-hero-actions">
            <Link className="landing-button" to="/login">Подключить клинику <span>↗</span></Link>
            <a className="landing-button-quiet" href="#product-preview"><span className="landing-play">▶</span> Посмотреть продукт</a>
          </div>
          <div className="landing-hero-note">
            <span className="landing-note-check">✓</span>
            Для частных клиник Казахстана · Русский и казахский
          </div>
        </div>

        <div className="landing-visual" id="product-preview" aria-label="Пример диалога в панели OzimAI">
          <div className="landing-visual-glow" />
          <div className="landing-window">
            <div className="landing-window-top">
              <div className="landing-window-brand"><span className="landing-mark">O</span> Ozim<span>AI</span></div>
              <div className="landing-window-status"><i /> Панель клиники</div>
              <div className="landing-window-avatar">М</div>
            </div>
            <div className="landing-window-body">
              <aside className="landing-mini-nav" aria-hidden="true">
                <span className="mini-nav-logo">O</span>
                <span className="mini-nav-icon selected">◷</span>
                <span className="mini-nav-icon">▦</span>
                <span className="mini-nav-icon">♙</span>
                <span className="mini-nav-icon">✦</span>
                <span className="mini-nav-icon">▤</span>
              </aside>
              <div className="landing-inbox">
                <div className="landing-inbox-heading">
                  <div><small>ПАНЕЛЬ КЛИНИКИ</small><strong>Диалоги</strong></div>
                  <span className="landing-live"><i /> онлайн</span>
                </div>
                <div className="landing-message-row">
                  <div className="landing-patient-avatar">АК</div>
                  <div className="landing-message-meta"><strong>Алия К.</strong><span>пример диалога</span></div>
                  <span className="landing-message-dot" />
                </div>
                <div className="landing-chat">
                  <div className="landing-chat-date">сегодня</div>
                  <div className="landing-bubble patient-bubble">Здравствуйте! Сколько стоит чистка?</div>
                  <div className="landing-bubble ai-bubble">
                    <span className="landing-ai-label">✦ Айым</span>
                    Профессиональная чистка — 25 000 ₸. Хотите подобрать удобное время?
                  </div>
                  <div className="landing-bubble patient-bubble">Да, можно завтра после обеда?</div>
                  <div className="landing-bubble ai-bubble">
                    <span className="landing-ai-label">✦ Айым</span>
                    Проверю свободные часы и предложу варианты.
                  </div>
                </div>
                <div className="landing-chat-footer"><span>Ответ подготовлен по данным клиники</span><span>✦</span></div>
              </div>
              <div className="landing-side-card">
                <div className="landing-side-heading">Контроль <span>↗</span></div>
                <div className="landing-side-metric"><strong>Календарь</strong><b>✓</b></div>
                <div className="landing-side-metric"><strong>База знаний</strong><b>✓</b></div>
                <div className="landing-side-divider" />
                <div className="landing-attention"><span>!</span><div><b>Нужен человек</b><small>Вопрос ждёт ответа</small></div></div>
                <div className="landing-appointment">
                  <div className="landing-appointment-icon">✓</div>
                  <div><b>Запись в календаре</b><small>После подтверждения пациента</small></div>
                </div>
              </div>
            </div>
          </div>
          <div className="landing-float-tag"><span>✦</span> Отвечает даже после закрытия</div>
        </div>
      </section>

      <section className="landing-proof" aria-label="Возможности OzimAI">
        <span>ОДИН ПОМОЩНИК</span>
        <b /> <span>ОТВЕТЫ</span>
        <b /> <span>ЗАПИСЬ</span>
        <b /> <span>НАПОМИНАНИЯ</span>
        <b /> <span>КОНТРОЛЬ КОМАНДЫ</span>
      </section>

      <section className="landing-section landing-benefits" id="benefits">
        <div className="landing-section-heading">
          <div className="landing-kicker">МЕНЬШЕ РУТИНЫ · БОЛЬШЕ ВНИМАНИЯ ПАЦИЕНТАМ</div>
          <h2>Ваш цифровой администратор.<br /><span>В ритме вашей клиники.</span></h2>
          <p>Не ещё один чат-бот с кнопками. Помощник, который знает правила клиники и умеет действовать.</p>
        </div>
        <div className="landing-feature-grid">
          {FEATURES.map((feature) => (
            <article className="landing-feature-card" key={feature.number}>
              <div className="landing-feature-top"><span className="landing-feature-icon">{feature.icon}</span><span>{feature.number}</span></div>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-workflow" id="how-it-works">
        <div className="landing-workflow-intro">
          <div className="landing-kicker">ПРОСТО НАЧАТЬ</div>
          <h2>От знакомства<br />до первого диалога.</h2>
          <p>Настройте помощника под свою клинику и оставьте за командой последнее слово.</p>
          <Link to="/login" className="landing-text-link">Начать настройку <span>→</span></Link>
        </div>
        <div className="landing-steps">
          {STEPS.map(([title, text], index) => (
            <article className="landing-step" key={title}>
              <div className="landing-step-number">0{index + 1}</div>
              <div><h3>{title}</h3><p>{text}</p></div>
              <span className="landing-step-arrow">↗</span>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-safety" id="safety">
        <div className="landing-safety-icon">✦</div>
        <div>
          <div className="landing-kicker">ВАША КЛИНИКА · ВАШИ ПРАВИЛА</div>
          <h2>AI помогает с сервисом.<br /><span>Решения остаются за людьми.</span></h2>
          <p>Ответы строятся на информации вашей клиники. Медицинские вопросы и нестандартные ситуации можно передать администратору, а команда может следить за диалогами и подключиться в любой момент.</p>
        </div>
        <div className="landing-safety-points">
          <div><span>✓</span> Информация из базы клиники</div>
          <div><span>✓</span> Передача диалога человеку</div>
          <div><span>✓</span> Контроль записей и обращений</div>
        </div>
      </section>

      <section className="landing-bottom-cta">
        <div className="landing-kicker">OZIMAI · AI-АДМИНИСТРАТОР</div>
        <h2>Пусть ни одно сообщение<br />не останется без внимания.</h2>
        <p>Посмотрите, как OzimAI общается с пациентом вашей клиники.</p>
        <div className="landing-hero-actions">
          <Link className="landing-button" to="/c/aigul">Открыть демо-чат <span>↗</span></Link>
          <Link className="landing-button-quiet" to="/login">Подключить клинику <span>→</span></Link>
        </div>
        <div className="landing-cta-footnote">Демо клиники «Айгуль» · Без регистрации</div>
      </section>

      <footer className="landing-footer">
        <Link className="landing-brand" to="/" aria-label="OzimAI — на главную">Ozim<span>AI</span></Link>
        <span>AI-администратор для клиник Казахстана</span>
        <a href="#top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Наверх ↑</a>
      </footer>
    </main>
  );
}
