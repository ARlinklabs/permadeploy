import React, { useEffect, useState } from "react";
import { cn, DEPLOYMENT_WALLET } from "@/lib/utils";
import axios from "axios";
import { Bell, ChevronDown, HelpCircle, Plus, UserCircle2 } from "lucide-react";
import { IconBrandTabler } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ConnectButton, useConnection } from "arweave-wallet-kit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const menuItems = [
    { label: "Overview", href: "/dashboard" },
    { label: "Deploy", href: "/import" },
];

export default function Layout({ children }: { children?: React.ReactNode }) {
    const { connected } = useConnection();
    const [arBalance, setArBalance] = useState(0);
    const router = useRouter();

    useEffect(() => {
        axios.get(`https://arweave.net/wallet/${DEPLOYMENT_WALLET}/balance`)
            .then(res => setArBalance((res.data as number) / 1000000000000));
    }, []);

    return (
        <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-neutral-800">
            <nav className="flex flex-col bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-700">
                <div className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center space-x-4">
                        <Link href="/" className="text-2xl">⚡️ ARlink</Link>
                    </div>
                    <div className="flex items-center space-x-4">
                        <Button variant="ghost" size="sm">
                            <HelpCircle className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="sm">Docs</Button>
                        <ConnectButton />
                    </div>
                </div>
                <div className="flex space-x-4 px-4">
                    {menuItems.map((item, index) => (
                        <Link key={index} href={item.href} passHref>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`text-sm ${router.pathname === item.href ? 'text-black dark:text-white border-b-2 border-black dark:border-white' : 'text-gray-500 dark:text-gray-400'}`}
                            >
                                {item.label}
                            </Button>
                        </Link>
                    ))}
                </div>
            </nav>
            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1  rounded-t-2xl md:rounded-none bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 overflow-auto">
                    {connected ? children : "Connect Wallet to continue :)"}
                </div>
            </div>
            <div className="bg-white dark:bg-neutral-900 p-4 border-t border-neutral-200 dark:border-neutral-700">
                <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                    <div className="mb-2">Deployment Fund</div>
                    <div>{`${arBalance}`.substring(0, 4)} $AR | ? turbo credits</div>
                    <div className="text-xs mt-2 leading-relaxed">
                        The service uses a central wallet topped up with $AR and turbo credits to ease your deployment process.
                        To contribute to deployment fund, gift turbo credits or send $AR at
                        <span className="font-mono bg-black/30 p-1 rounded text-[10.5px] ml-1">{DEPLOYMENT_WALLET}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}