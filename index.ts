import { scrape_wikidata } from "./wikidata_scraper";
import { writeFileSync } from "fs";

const people = await scrape_wikidata()
writeFileSync("people.json", JSON.stringify(people, null, 2));