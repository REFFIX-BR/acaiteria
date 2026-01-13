import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface WelcomeModalProps {
  open: boolean
  onClose: () => void
  userName?: string
}

export function WelcomeModal({ open, onClose, userName }: WelcomeModalProps) {
  const [showCheck, setShowCheck] = useState(false)

  useEffect(() => {
    if (open) {
      // Anima o check após um pequeno delay
      const timer = setTimeout(() => {
        setShowCheck(true)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setShowCheck(false)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: showCheck ? 1 : 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 200,
                  damping: 15,
                }}
                className="relative"
              >
                <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: showCheck ? [1, 1.2, 1] : 0,
                    opacity: showCheck ? [1, 0.8, 1] : 0,
                  }}
                  transition={{
                    delay: 0.3,
                    duration: 0.6,
                    times: [0, 0.5, 1],
                  }}
                  className="absolute inset-0 rounded-full bg-green-500/20"
                />
              </motion.div>
              
              {/* Partículas de confete */}
              <AnimatePresence>
                {showCheck && (
                  <>
                    {[...Array(8)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ 
                          scale: 0,
                          x: 0,
                          y: 0,
                          opacity: 1,
                        }}
                        animate={{
                          scale: [0, 1, 0],
                          x: Math.cos((i * Math.PI * 2) / 8) * 60,
                          y: Math.sin((i * Math.PI * 2) / 8) * 60,
                          opacity: [1, 1, 0],
                        }}
                        transition={{
                          delay: 0.5,
                          duration: 1,
                          ease: 'easeOut',
                        }}
                        className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-green-500"
                        style={{
                          transform: 'translate(-50%, -50%)',
                        }}
                      />
                    ))}
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          <DialogTitle className="text-2xl font-bold text-center mt-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: showCheck ? 1 : 0, y: showCheck ? 0 : 10 }}
              transition={{ delay: 0.4 }}
            >
              {userName ? `Bem-vindo, ${userName}!` : 'Conta criada com sucesso!'}
            </motion.div>
          </DialogTitle>
          
          <div className="text-center space-y-3 mt-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: showCheck ? 1 : 0, y: showCheck ? 0 : 10 }}
              transition={{ delay: 0.5 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-center gap-2 text-lg font-semibold text-green-600 dark:text-green-400">
                <Sparkles className="h-5 w-5 animate-pulse" />
                <span>7 dias de teste grátis!</span>
              </div>
              <DialogDescription className="text-sm text-muted-foreground">
                Você adquiriu <strong>7 dias gratuitos</strong> para testar todas as funcionalidades da plataforma.
              </DialogDescription>
              <DialogDescription className="text-sm text-muted-foreground">
                Explore o sistema, configure sua açaiteria e descubra como podemos ajudar seu negócio a crescer!
              </DialogDescription>
            </motion.div>
          </div>
        </DialogHeader>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: showCheck ? 1 : 0, y: showCheck ? 0 : 10 }}
          transition={{ delay: 0.6 }}
          className="mt-6"
        >
          <Button onClick={onClose} className="w-full" size="lg">
            Começar agora
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
