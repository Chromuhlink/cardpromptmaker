import type { Metadata } from "next";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const imageUrl = decodeURIComponent(params.id);
  const title = "Card Prompt Maker";
  const description = "Getting inspired using the prompt generator, try it out and use the prompts on daisy.so";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function SharePage() {
  return null;
}


