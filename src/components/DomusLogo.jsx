// Domus-Bildmarke in Faktio-Farben. Inline statt <img>, damit das Haus der in der App
// gewählten Darstellung folgt (--color-logo), nicht nur der Systemeinstellung.
const DomusLogo = ({ size = 32, className, title }) => (
    <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 32 32"
        role={title ? 'img' : undefined}
        aria-label={title || undefined}
        aria-hidden={title ? undefined : true}
    >
        <path d="M16 2L2 14H6V28H13V18H19V28H26V14H30L16 2Z" fill="var(--color-logo, #16193a)" />
        <path d="M13 18h3.5a2.5 2.5 0 0 1 2.5 2.5V28h-6z" fill="var(--color-mint, #2fd08f)" />
    </svg>
);

export default DomusLogo;
