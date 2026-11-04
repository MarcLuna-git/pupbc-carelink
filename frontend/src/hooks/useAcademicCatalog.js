import { useEffect, useState } from 'react';
import authService from '../services/authService';

// Courses and sections from Nurse → Course Management. Fetched on every mount so a
// course the nurse just added shows up without a page reload; [] until it loads.
export default function useAcademicCatalog() {
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    let alive = true;
    authService.registrationOptions()
      .then((list) => { if (alive) setCatalog(list); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return catalog;
}
