'use client'
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { EditUserProfileSchema } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type Props = {
    user: any
    onUpdate?: any
}

const ProfileForm = ({ user, onUpdate }: Props) => {
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof EditUserProfileSchema>>({
        mode: 'onChange',
        resolver: zodResolver(EditUserProfileSchema),
        defaultValues: {
            name: user?.name || '',
            email: user?.email || '',
        },
    })

    const handleSubmit = async (
        values: z.infer<typeof EditUserProfileSchema>
    ) => {
        setIsLoading(true)
        try {
            await onUpdate(values.name)
        } catch (error) {
            console.error('Error updating profile:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (user) {
            form.reset({
                name: user.name || '',
                email: user.email || ''
            })
        }
    }, [user, form])

    if (!user) {
        return (
            <div className='flex items-center justify-center p-8'>
                <Loader2 className='h-6 w-6 animate-spin' />
                <span className='ml-2'>Loading user data...</span>
            </div>
        )
    }

    return (
        <Form {...form}>
            <form 
            className='flex flex-col gap-6'
            onSubmit={form.handleSubmit(handleSubmit)}
            >
                <FormField
                 disabled={isLoading}
                 control={form.control}
                 name="name"
                 render={({ field })=>(
                    <FormItem>
                        <FormLabel className='text-lg'>User full name</FormLabel>
                        <FormControl>
                            <Input
                             {...field}
                             placeholder='Enter your full name'
                             />
                        </FormControl>
                        <FormMessage/>
                    </FormItem>
                 )}
                />
                <FormField
                 control={form.control}
                 name="email"
                 render={({ field })=>(
                    <FormItem>
                        <FormLabel className='text-lg'>Email</FormLabel>
                        <FormControl>
                            <Input
                             {...field}
                             disabled={true}
                             placeholder='Email'
                             type='email'
                             />
                        </FormControl>
                        <FormMessage/>
                    </FormItem>
                 )}
                />
                <Button
                 type="submit"
                 disabled={isLoading}
                 className='self-start bg-[#DDDDDD] text-black hover:bg-[#2F006B] hover:text-white'
                >
                    {isLoading ? (
                        <>
                        <Loader2 className='mr-2 h-4 w-4 animate-spin'/>
                        Saving
                        </>
                    ):(
                        'Save User Settings'
                    )}
                </Button>
            </form>
        </Form>
    )
}

export default ProfileForm;