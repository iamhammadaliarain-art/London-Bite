import Link from "next/link";

export default function NotFound() {
  return <main className="notFound"><span className="brandMark">LB</span><h1>Page not found</h1><p>This route is not part of the London Bite platform.</p><Link className="primaryButton linkButton" href="/management/dashboard">Open dashboard</Link></main>;
}
