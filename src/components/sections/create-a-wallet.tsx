"use client";

import { useCreateWallet as useCreateEvmWallet } from "@privy-io/react-auth";
import Section from "../reusables/section";
import { showSuccessToast, showErrorToast } from "../ui/custom-toast";


const CreateAWallet = () => {
  const { createWallet: createWalletEvm } = useCreateEvmWallet({
    onSuccess: ({ wallet }) => {
      showSuccessToast("EVM wallet created successfully.");
      console.log("Created wallet ", wallet);
    },
    onError: (error) => {
      console.log(error);
      showErrorToast("EVM wallet creation failed.");
    },
  });

  const createWalletEvmHandler = async () => {
    await createWalletEvm({
      createAdditional: true,
    });
  };


  const availableActions = [
    {
      name: "Create Ethereum wallet",
      function: createWalletEvmHandler,
    },
 
   
  ];
  return (
    <Section
      name="Create a wallet"
      description={
        "Creates a new wallet for the user. To limit to a single wallet per user, remove the createAdditional flag from createWallet"
      }
      filepath="src/components/sections/create-a-wallet"
      actions={availableActions}
    />
  );
};

export default CreateAWallet;
