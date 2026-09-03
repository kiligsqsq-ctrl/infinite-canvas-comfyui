import { ArrowRight } from "lucide-react";
import { type ReactNode } from "react";
import { Button } from "antd";
import { useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

function Highlighter({ action, color, children }: { action: "highlight" | "underline"; color: string; children?: ReactNode }) {
    return (
        <span className="relative inline-block px-1">
            {action === "highlight" ? (
                <span className="absolute inset-x-0 bottom-0 top-1 rounded-sm opacity-45" style={{ backgroundColor: color }} />
            ) : (
                <span className="absolute inset-x-0 bottom-0 h-1 rounded-full opacity-80" style={{ backgroundColor: color }} />
            )}
            <span className="relative font-medium text-white">{children}</span>
        </span>
    );
}

export default function IndexPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <main className="relative h-full overflow-hidden bg-[#05070d] text-white">
            <div className="pointer-events-none absolute inset-0 scale-[1.02] bg-cover bg-center" style={{ backgroundImage: "url('/brand/home-hero.png')" }} />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(5,7,13,.06)_0%,rgba(5,7,13,.12)_42%,rgba(5,7,13,.38)_100%)]" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/30" />
            <section className="relative mx-auto h-full max-w-7xl overflow-hidden px-6">
                <div className="relative flex h-full min-h-[620px] flex-col items-center justify-center text-center">
                    <h1 className="max-w-5xl bg-gradient-to-r from-white via-[#dfe7ff] to-[#b7dfff] bg-clip-text text-balance text-5xl font-semibold tracking-normal text-transparent drop-shadow-[0_12px_42px_rgba(75,110,255,.38)] sm:text-7xl lg:text-8xl">{t("meta.title")}</h1>
                    <p className="mt-8 max-w-3xl text-balance text-lg leading-8 text-white/70 drop-shadow-lg">
                        <Trans i18nKey="home.description" components={{ canvas: <Highlighter action="underline" color="#FF9800" />, content: <Highlighter action="highlight" color="#87CEFA" /> }} />
                    </p>
                    <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                        <Button type="primary" size="large" className="!border-white/80 !bg-white !font-medium !text-stone-950 !shadow-[0_14px_40px_rgba(0,0,0,.32)] hover:!border-white hover:!bg-white/90" onClick={() => navigate("/canvas")} icon={<ArrowRight className="size-4" />} iconPlacement="end">
                            {t("home.openCanvas")}
                        </Button>
                    </div>
                </div>
            </section>
        </main>
    );
}
