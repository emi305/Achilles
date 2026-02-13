import Image from "next/image";

type BrandHeaderProps = {
  subtitle?: string;
};

export function BrandHeader({ subtitle }: BrandHeaderProps) {
  return (
    <header className="mx-auto flex max-w-2xl flex-col items-center text-center">
      <Image src="/greek/parthenon.svg" alt="Parthenon icon" width={148} height={88} priority />
      <h1 className="brand-title mt-3 text-4xl tracking-wide text-stone-800 sm:text-5xl">Achilles Insight</h1>
      {subtitle ? <p className="mt-3 text-base text-stone-700 sm:text-lg">{subtitle}</p> : null}
    </header>
  );
}
