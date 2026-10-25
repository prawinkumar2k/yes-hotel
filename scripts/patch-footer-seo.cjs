const fs = require('fs');

let content = fs.readFileSync('client/components/hotel/Footer.tsx', 'utf8');

const target = `{/* Copyright Bar */}`;
const replacement = `{/* Verified Nearby Corridors & Discovery */}
        <div className="border-t border-[#262930] pt-6 space-y-3 font-mono text-xs">
          <span className="text-[#c9a227] font-bold uppercase tracking-widest block text-[11px]">
            Hotels & Rooms Near South Bengaluru Corridors
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-gray-400 font-sans text-xs">
            <Link to="/hotels-near/hosa-road" className="hover:text-[#c9a227] transition">Hotels at Hosa Road Junction</Link>
            <span>•</span>
            <Link to="/hotels-near/electronic-city" className="hover:text-[#c9a227] transition">Hotels Near Electronic City (Phase 1 & 2)</Link>
            <span>•</span>
            <Link to="/hotels-near/bommasandra" className="hover:text-[#c9a227] transition">Hotels Near Bommasandra Industrial Area</Link>
            <span>•</span>
            <Link to="/hotels-near/narayana-health-city" className="hover:text-[#c9a227] transition">Hotels Near Narayana Health City</Link>
            <span>•</span>
            <Link to="/hotels-near/bommanahalli" className="hover:text-[#c9a227] transition">Hotels Near Bommanahalli & Silk Board</Link>
            <span>•</span>
            <Link to="/hotels-near/singasandra" className="hover:text-[#c9a227] transition">Hotels Near Singasandra</Link>
            <span>•</span>
            <Link to="/hotels-near/kudlu-gate" className="hover:text-[#c9a227] transition">Hotels Near Kudlu Gate</Link>
            <span>•</span>
            <Link to="/hotels-near/hosa-road-metro-station" className="hover:text-[#c9a227] transition">Hotels Beside Hosa Road Metro (100m)</Link>
            <span>•</span>
            <Link to="/hotels-near/begur" className="hover:text-[#c9a227] transition">Hotels Near Begur</Link>
            <span>•</span>
            <Link to="/hotels-near/hebbagodi" className="hover:text-[#c9a227] transition">Hotels Near Hebbagodi</Link>
          </div>
        </div>

        {/* Copyright Bar */}`;

if (!content.includes('Hotels & Rooms Near South Bengaluru Corridors')) {
  content = content.replace(target, replacement);
  fs.writeFileSync('client/components/hotel/Footer.tsx', content, 'utf8');
  console.log('Successfully added internal SEO corridor links to Footer.tsx');
} else {
  console.log('SEO links already in Footer.tsx');
}
