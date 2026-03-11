"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";

const UserObject = () => {
  const { user,getAccessToken  } = usePrivy();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  useEffect( () => {
async function fetchAccessToken() {
const newAccessToken = await getAccessToken();
setAccessToken(newAccessToken);
}
fetchAccessToken();
  }, [getAccessToken])
  return (
    <div className="w-full md:w-[400px] bg-white flex flex-col gap-2 border-l border-[#E2E3F0] p-4 h-[calc(100vh-60px)]">
      <h3 className="text-md font-semibold">User object</h3>
      <pre className="bg-[#F1F2F9] p-2 overflow-y-auto rounded-lg flex-1 text-xs font-light whitespace-pre-wrap">
        {JSON.stringify(user, null, 2)}
      </pre>
      <pre className="bg-[#F1F2F9] p-2 overflow-y-auto rounded-lg flex-1 text-xs font-light whitespace-pre-wrap">
        <h4>Access token:</h4>
        {accessToken}
      </pre>
    </div>
  );
};

export default UserObject;
