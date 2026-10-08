import React from 'react';
import { StyleSheet, View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormSpec } from './types';
import { useLanguage } from './i18n';
export const C = {ink:'#0F172A', muted:'#64748B', teal:'#0F2851', pale:'#EEF4FF', bg:'#F4F6F9', line:'#E2E8F0', orange:'#E65100', red:'#D93025', white:'#FFFFFF'};
export const Icon = ({name,size=21,color=C.ink}:{name:any;size?:number;color?:string}) => <Ionicons name={name} size={size} color={color}/>;
export function Button({title,onPress,secondary=false,disabled=false,icon}:{title:string;onPress:()=>void;secondary?:boolean;disabled?:boolean;icon?:string}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={[s.button,secondary&&s.secondary,disabled&&{opacity:0.5}]}>{icon&&<Icon name={icon} size={18} color={secondary?C.teal:C.white}/>}<Text style={[s.buttonText,secondary&&{color:C.teal}]}>{title}</Text></Pressable>;
}
export function Badge({label,tone='green'}:{label:string;tone?:string}) { return <View style={[s.badge,{backgroundColor:tone==='orange'?'#FFF0E0':tone==='red'?'#FAE9E6':C.pale}]}><Text style={[s.badgeText,{color:tone==='orange'?C.orange:tone==='red'?C.red:C.teal}]}>{label}</Text></View>; }
export function Empty({title,description,action}:{title:string;description:string;action?:React.ReactNode}) { return <View style={s.empty}><View style={s.emptyIcon}><Icon name="layers-outline" size={28} color={C.teal}/></View><Text style={s.h3}>{title}</Text><Text style={[s.muted,{textAlign:'center',maxWidth:340}]}>{description}</Text>{action}</View>; }
export function Section({title,subtitle,action}:{title:string;subtitle?:string;action?:React.ReactNode}) { return <View style={s.section}><View style={{flex:1}}><Text style={s.h2}>{title}</Text>{subtitle&&<Text style={s.muted}>{subtitle}</Text>}</View>{action}</View>; }
export function Metric({label,value,foot,accent=false}:{label:string;value:string;foot?:string;accent?:boolean}) { return <View style={[s.metric,accent&&{backgroundColor:C.teal,borderColor:C.teal}]}><Text style={[s.metricLabel,accent&&{color:'#C8E0D6'}]}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[s.metricValue,{fontSize:value.length>8?19:24},accent&&{color:'white'}]}>{value}</Text>{foot&&<Text style={[s.small,accent&&{color:'#C8E0D6'}]}>{foot}</Text>}</View>; }
export function FormModal({spec,onClose,onSave,busy,error}:{spec:FormSpec;onClose:()=>void;onSave:(v:Record<string,string>)=>void;busy:boolean;error:string}) {
  const { t, lang } = useLanguage();
  const [values,setValues] = React.useState(spec.initial);
  return <Modal visible animationType="slide" onRequestClose={()=>!busy&&onClose()} presentationStyle="pageSheet"><SafeAreaView style={{flex:1,backgroundColor:C.bg}}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><View style={[s.formHeader]}><View style={{flex:1}}><Text style={s.h2}>{spec.title}</Text><Text style={s.muted}>{spec.subtitle}</Text></View><Pressable accessibilityLabel="Close form" onPress={()=>!busy&&onClose()} style={s.iconButton}><Icon name="close"/></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.formBody}>
    {spec.fields.map(f=><View key={f.key} style={{gap:8}}><Text style={s.label}>{f.label}</Text>{f.options?<View style={s.wrap}>{f.options.map(o=><Pressable accessibilityRole="button" accessibilityState={{selected:values[f.key]===o.value}} key={o.value} onPress={()=>setValues({...values,[f.key]:o.value})} style={[s.chip,values[f.key]===o.value&&s.chipActive]}><Text style={[s.chipText,values[f.key]===o.value&&{color:C.teal,fontWeight:'700'}]}>{o.label}</Text></Pressable>)}{f.options.length===0&&<Text style={{color:C.red}}>{lang === 'hi' ? 'कृपया पहले आवश्यक साइट / मजदूर / बिल जोड़ें।' : 'Add the required site / worker / bill first.'}</Text>}</View>:<TextInput accessibilityLabel={f.label} value={values[f.key]||''} onChangeText={v=>setValues({...values,[f.key]:v})} placeholder={f.placeholder||f.label} placeholderTextColor="#94A19A" style={[s.input,f.multiline&&{minHeight:100,textAlignVertical:'top'}]} keyboardType={f.numeric?'decimal-pad':'default'} multiline={f.multiline} autoCapitalize={f.key.includes('date')?'none':'sentences'}/>}</View>)}
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}<Button title={busy?(lang === 'hi' ? 'सुरक्षित किया जा रहा है…' : 'Saving…'):(lang === 'hi' ? 'रिकॉर्ड सेव करें' : 'Save record')} onPress={()=>onSave(values)} disabled={busy}/><Text style={[s.small,{textAlign:'center'}]}>{lang === 'hi' ? 'सभी बदलाव आपकी गतिविधि इतिहास में सुरक्षित दर्ज होते हैं।' : 'Changes are recorded in your activity history.'}</Text>
  </ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>;
}
export const s = StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},container:{width:'100%',maxWidth:1100,alignSelf:'center'},
  topbar:{paddingHorizontal:24,paddingVertical:16,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderColor:C.line,backgroundColor:C.bg},
  brandIcon:{width:42,height:42,borderRadius:13,backgroundColor:C.teal,alignItems:'center',justifyContent:'center'},
  brand:{fontSize:21,fontWeight:'800',letterSpacing:-0.7,color:C.ink},eyebrow:{fontSize:10,fontWeight:'700',letterSpacing:1.8,color:C.muted},
  avatar:{width:38,height:38,borderRadius:19,backgroundColor:'#E8E7D9',alignItems:'center',justifyContent:'center'},
  content:{padding:24,gap:20,paddingBottom:40},h1:{fontSize:29,fontWeight:'800',letterSpacing:-1,color:C.ink},h2:{fontSize:20,fontWeight:'700',letterSpacing:-0.5,color:C.ink},h3:{fontSize:16,fontWeight:'700',color:C.ink},
  muted:{fontSize:13,lineHeight:20,color:C.muted},small:{fontSize:11,lineHeight:17,color:C.muted},label:{fontSize:13,fontWeight:'600',color:C.ink},
  section:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},row:{flexDirection:'row',alignItems:'center',gap:12},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},
  button:{minHeight:46,paddingHorizontal:17,paddingVertical:12,borderRadius:12,backgroundColor:C.teal,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},secondary:{backgroundColor:C.pale},buttonText:{fontSize:13,fontWeight:'700',color:'white'},
  card:{padding:19,borderRadius:18,borderWidth:1,borderColor:C.line,backgroundColor:C.white,gap:14},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:12},metric:{flexGrow:1,flexBasis:145,padding:18,minHeight:117,borderWidth:1,borderColor:C.line,borderRadius:17,backgroundColor:C.white,gap:8},metricLabel:{fontSize:12,color:C.muted,fontWeight:'500'},metricValue:{fontSize:24,fontWeight:'800',letterSpacing:-0.7,color:C.ink},
  badge:{paddingHorizontal:9,paddingVertical:5,borderRadius:7,alignSelf:'flex-start'},badgeText:{fontSize:10,fontWeight:'700',letterSpacing:0.3},
  chip:{paddingHorizontal:13,paddingVertical:10,borderRadius:10,borderWidth:1,borderColor:C.line,backgroundColor:'white'},chipActive:{backgroundColor:C.pale,borderColor:'#98BCAF'},chipText:{fontSize:12,color:C.muted},
  input:{backgroundColor:'white',borderWidth:1,borderColor:C.line,paddingHorizontal:14,paddingVertical:13,minHeight:48,borderRadius:11,color:C.ink,fontSize:14},
  iconButton:{padding:10,borderRadius:10},empty:{padding:28,gap:13,alignItems:'center',borderWidth:1,borderStyle:'dashed',borderColor:'#CAD5CC',borderRadius:18},emptyIcon:{height:54,width:54,borderRadius:18,backgroundColor:C.pale,alignItems:'center',justifyContent:'center'},
  bottom:{flexDirection:'row',borderTopWidth:1,borderColor:C.line,backgroundColor:'white',paddingVertical:9,paddingHorizontal:5},navItem:{flex:1,alignItems:'center',gap:5,paddingVertical:5},navLabel:{fontSize:10,fontWeight:'600',color:C.muted},
  formHeader:{padding:22,borderBottomWidth:1,borderColor:C.line,flexDirection:'row',gap:12},formBody:{padding:24,gap:20,width:'100%',maxWidth:650,alignSelf:'center',paddingBottom:60},
  error:{color:C.red,padding:12,backgroundColor:'#FAE9E6',borderRadius:10,lineHeight:20},
  divider:{height:1,backgroundColor:C.line},notice:{backgroundColor:'#FFF2DF',padding:14,borderRadius:13,flexDirection:'row',alignItems:'center',gap:10},
  hero:{padding:23,borderRadius:21,backgroundColor:C.teal,gap:17},heroValue:{fontSize:37,fontWeight:'800',letterSpacing:-1.2,color:'white'},
  toast:{backgroundColor:'#ECFDF5',borderWidth:1,borderColor:'#A7F3D0',paddingVertical:11,paddingHorizontal:16,marginHorizontal:20,borderRadius:14},
});
