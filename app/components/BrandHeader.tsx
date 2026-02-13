import Image from "next/image";

type BrandHeaderProps = {
  subtitle?: string;
};

export function BrandHeader({ subtitle }: BrandHeaderProps) {
  return (
    <header className="mx-auto flex max-w-3xl flex-col items-center text-center">
      <Image src="/greek/parthenon.svg" alt="Parthenon icon" width={160} height={96} priority />
      <h1 className="brand-title mt-3 text-4xl tracking-[0.12em] text-stone-800 sm:text-5xl">ACHILLES INSIGHT</h1>
      <p className="mt-2 text-sm font-medium uppercase tracking-[0.08em] text-stone-600 sm:text-base">
        Find your Achilles Heel
      </p>
      {subtitle ? <p className="mt-3 max-w-2xl text-base text-stone-700 sm:text-lg">{subtitle}</p> : null}
    </header>
  );
}
